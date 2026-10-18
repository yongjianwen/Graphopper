import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type {
  BackendStore,
  Graph,
  NodeResource,
  Relationship,
  User,
} from '../../application/backend-store.js';
import type { RuntimeConfig } from '../../configuration/runtime-config.js';
import { ApiError } from '../../modules/api/api-error.js';
import type { Authenticator } from '../../modules/authentication/authenticator.js';
import { page } from '../../modules/query/cursor.js';

interface RegisterRoutesOptions {
  app: FastifyInstance;
  authenticator: Authenticator;
  config: RuntimeConfig;
  store: BackendStore;
}

interface AuthenticatedRequest extends FastifyRequest {
  graphopperUser: User;
}

const metrics = {
  requests: 0,
  errors: 0,
  traversals: 0,
  traversalTruncations: 0,
  uploadAuthorizations: 0,
  uploadCompletions: 0,
};

export function registerRoutes({
  app,
  authenticator,
  config,
  store,
}: RegisterRoutesOptions): void {
  const rateWindows = new Map<string, { count: number; resetAt: number }>();
  app.addHook('onRequest', () => {
    metrics.requests += 1;
    return Promise.resolve();
  });
  app.addHook('onError', () => {
    metrics.errors += 1;
    return Promise.resolve();
  });
  app.addHook('preHandler', async (request) => {
    if ((request.routeOptions.config as { auth?: boolean }).auth !== true)
      return;
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer '))
      throw new ApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        'A bearer access token is required.',
      );
    const claims = await authenticator.authenticate(authorization.slice(7));
    const resolvedUser = store.resolveUser(claims, config.jitProvisioning);
    const now = Date.now();
    const previous = rateWindows.get(resolvedUser.id);
    const window =
      !previous || previous.resetAt <= now
        ? { count: 0, resetAt: now + 60_000 }
        : previous;
    window.count += 1;
    rateWindows.set(resolvedUser.id, window);
    if (window.count > 300)
      throw new ApiError(
        429,
        'RATE_LIMITED',
        'The request rate limit was exceeded.',
      );
    (request as AuthenticatedRequest).graphopperUser = resolvedUser;
  });

  app.get('/health/live', () => ({ status: 'ok' }));
  app.get('/health/ready', () => ({ status: 'ready' }));
  app.get('/metrics', (_request, reply) => {
    void reply.type('text/plain; version=0.0.4');
    return (
      Object.entries(metrics)
        .map(([name, value]) => `graphopper_${camelToSnake(name)} ${value}`)
        .join('\n') + '\n'
    );
  });

  app.get('/v1/me', protectedRoute(), (request) => publicUser(user(request)));

  app.post('/v1/graphs', protectedRoute(), (request, reply) => {
    const body = objectBody(request);
    allow(body, ['name', 'description', 'templateFields']);
    const currentUser = user(request);
    const graph = store.idempotent(
      currentUser.id,
      'POST /v1/graphs',
      idempotencyKey(request),
      body,
      () => store.createGraph(currentUser.id, body, request.id),
    );
    return created(reply, graphRepresentation(graph));
  });

  app.get('/v1/graphs', protectedRoute(), (request) => {
    const query = queryObject(request);
    allow(query, ['cursor', 'limit', 'sort']);
    const values = store.graphsFor(user(request).id);
    sortResources(values, query.sort);
    return page(
      values.map((graph) => graphRepresentation(graph)),
      query.limit,
      query.cursor,
      `graphs:${typeof query.sort === 'string' ? query.sort : 'createdAt'}`,
      config.cursorSecret,
      config.maxPageSize,
    );
  });

  app.get('/v1/graphs/:graphId', protectedRoute(), (request, reply) => {
    const { graphId } = params(request, ['graphId']);
    const graph = store.findGraph(user(request).id, graphId!);
    if (!graph) notFound();
    etag(reply, graph.version);
    return graphRepresentation(graph, true);
  });

  app.patch('/v1/graphs/:graphId', protectedRoute(), (request, reply) => {
    const { graphId } = params(request, ['graphId']);
    const body = objectBody(request);
    allow(body, ['name', 'description']);
    requireMutation(body);
    const graph = store.updateGraph(
      user(request).id,
      graphId!,
      body,
      expectedVersion(request),
      request.id,
    );
    etag(reply, graph.version);
    return graphRepresentation(graph, true);
  });

  app.delete('/v1/graphs/:graphId', protectedRoute(), (request, reply) => {
    const { graphId } = params(request, ['graphId']);
    store.deleteGraph(user(request).id, graphId!, request.id);
    return reply.code(204).send();
  });

  app.get(
    '/v1/graphs/:graphId/template',
    protectedRoute(),
    (request, reply) => {
      const { graphId } = params(request, ['graphId']);
      const graph = store.findGraph(user(request).id, graphId!);
      if (!graph) notFound();
      etag(reply, graph.version);
      return templateRepresentation(graph);
    },
  );

  app.post(
    '/v1/graphs/:graphId/template/fields',
    protectedRoute(),
    (request, reply) => {
      const { graphId } = params(request, ['graphId']);
      const body = objectBody(request);
      allow(body, fieldProperties.concat(['materializeDefault']));
      const field = store.addField(
        user(request).id,
        graphId!,
        body,
        requiredExpectedVersion(request),
        request.id,
        config.maxTemplateMigrationNodes,
      );
      return created(reply, field);
    },
  );

  app.patch(
    '/v1/graphs/:graphId/template/fields/:fieldId',
    protectedRoute(),
    (request, reply) => {
      const { graphId, fieldId } = params(request, ['graphId', 'fieldId']);
      const body = objectBody(request);
      allow(body, fieldProperties.concat(['conversionPolicy']));
      requireMutation(body);
      const field = store.updateField(
        user(request).id,
        graphId!,
        fieldId!,
        body,
        requiredExpectedVersion(request),
        request.id,
        config.maxTemplateMigrationNodes,
      );
      etag(reply, field.version);
      return field;
    },
  );

  app.delete(
    '/v1/graphs/:graphId/template/fields/:fieldId',
    protectedRoute(),
    (request, reply) => {
      const { graphId, fieldId } = params(request, ['graphId', 'fieldId']);
      const body = request.body === undefined ? {} : objectBody(request);
      allow(body, ['destructiveConfirmation']);
      store.deleteField(
        user(request).id,
        graphId!,
        fieldId!,
        requiredExpectedVersion(request),
        body.destructiveConfirmation === true,
        request.id,
        config.maxTemplateMigrationNodes,
      );
      return reply.code(204).send();
    },
  );

  app.post('/v1/graphs/:graphId/nodes', protectedRoute(), (request, reply) => {
    const { graphId } = params(request, ['graphId']);
    const body = objectBody(request);
    allow(body, ['values']);
    const values = recordProperty(body, 'values');
    const currentUser = user(request);
    const node = store.idempotent(
      currentUser.id,
      `POST /v1/graphs/${graphId}/nodes`,
      idempotencyKey(request),
      body,
      () => store.createNode(currentUser.id, graphId!, values, request.id),
    );
    return created(reply, node);
  });

  app.get('/v1/graphs/:graphId/nodes', protectedRoute(), (request) => {
    const { graphId } = params(request, ['graphId']);
    const query = queryObject(request);
    allow(query, ['cursor', 'limit', 'sort', 'filter', 'search']);
    const graph = store.findGraph(user(request).id, graphId!);
    if (!graph) notFound();
    let values = store.nodesFor(graphId!);
    const fieldIds = new Set(graph.fields.map((field) => field.id));
    values = filterNodes(values, query.filter, fieldIds);
    if (typeof query.search === 'string') {
      if (query.search.length > 200) queryLimit();
      const needle = query.search.toLocaleLowerCase();
      values = values.filter((node) =>
        Object.values(node.values).some(
          (value) =>
            typeof value === 'string' &&
            value.toLocaleLowerCase().includes(needle),
        ),
      );
    }
    sortNodes(values, query.sort, fieldIds);
    return page(
      values,
      query.limit,
      query.cursor,
      querySignature(query, ['cursor', 'limit']),
      config.cursorSecret,
      config.maxPageSize,
    );
  });

  app.get(
    '/v1/graphs/:graphId/nodes/:nodeId',
    protectedRoute(),
    (request, reply) => {
      const { graphId, nodeId } = params(request, ['graphId', 'nodeId']);
      const node = store.findNode(user(request).id, graphId!, nodeId!);
      if (!node) notFound();
      etag(reply, node.version);
      return node;
    },
  );

  app.patch(
    '/v1/graphs/:graphId/nodes/:nodeId',
    protectedRoute(),
    (request, reply) => {
      const { graphId, nodeId } = params(request, ['graphId', 'nodeId']);
      const body = objectBody(request);
      allow(body, ['values']);
      const node = store.updateNode(
        user(request).id,
        graphId!,
        nodeId!,
        recordProperty(body, 'values'),
        expectedVersion(request),
        request.id,
      );
      etag(reply, node.version);
      return node;
    },
  );

  app.delete(
    '/v1/graphs/:graphId/nodes/:nodeId',
    protectedRoute(),
    (request, reply) => {
      const { graphId, nodeId } = params(request, ['graphId', 'nodeId']);
      store.deleteNode(user(request).id, graphId!, nodeId!, request.id);
      return reply.code(204).send();
    },
  );

  app.post(
    '/v1/graphs/:graphId/relationships',
    protectedRoute(),
    (request, reply) => {
      const { graphId } = params(request, ['graphId']);
      const body = objectBody(request);
      allow(body, ['sourceNodeId', 'targetNodeId', 'type', 'label']);
      const currentUser = user(request);
      const relationship = store.idempotent(
        currentUser.id,
        `POST /v1/graphs/${graphId}/relationships`,
        idempotencyKey(request),
        body,
        () =>
          store.createRelationship(currentUser.id, graphId!, body, request.id),
      );
      return created(reply, relationship);
    },
  );

  app.get('/v1/graphs/:graphId/relationships', protectedRoute(), (request) => {
    const { graphId } = params(request, ['graphId']);
    const query = queryObject(request);
    allow(query, ['cursor', 'limit', 'sourceNodeId', 'targetNodeId', 'type']);
    if (!store.findGraph(user(request).id, graphId!)) notFound();
    let values = store.relationshipsFor(graphId!);
    if (typeof query.sourceNodeId === 'string')
      values = values.filter(
        (value) => value.sourceNodeId === query.sourceNodeId,
      );
    if (typeof query.targetNodeId === 'string')
      values = values.filter(
        (value) => value.targetNodeId === query.targetNodeId,
      );
    if (typeof query.type === 'string')
      values = values.filter((value) => value.type === query.type);
    return page(
      values,
      query.limit,
      query.cursor,
      querySignature(query, ['cursor', 'limit']),
      config.cursorSecret,
      config.maxPageSize,
    );
  });

  app.get(
    '/v1/graphs/:graphId/relationships/:relationshipId',
    protectedRoute(),
    (request, reply) => {
      const { graphId, relationshipId } = params(request, [
        'graphId',
        'relationshipId',
      ]);
      const relationship = store.findRelationship(
        user(request).id,
        graphId!,
        relationshipId!,
      );
      if (!relationship) notFound();
      etag(reply, relationship.version);
      return relationship;
    },
  );

  app.patch(
    '/v1/graphs/:graphId/relationships/:relationshipId',
    protectedRoute(),
    (request, reply) => {
      const { graphId, relationshipId } = params(request, [
        'graphId',
        'relationshipId',
      ]);
      const body = objectBody(request);
      allow(body, ['type', 'label']);
      requireMutation(body);
      const relationship = store.updateRelationship(
        user(request).id,
        graphId!,
        relationshipId!,
        body,
        expectedVersion(request),
        request.id,
      );
      etag(reply, relationship.version);
      return relationship;
    },
  );

  app.delete(
    '/v1/graphs/:graphId/relationships/:relationshipId',
    protectedRoute(),
    (request, reply) => {
      const { graphId, relationshipId } = params(request, [
        'graphId',
        'relationshipId',
      ]);
      store.deleteRelationship(
        user(request).id,
        graphId!,
        relationshipId!,
        request.id,
      );
      return reply.code(204).send();
    },
  );

  app.get('/v1/graphs/:graphId/traversals', protectedRoute(), (request) => {
    metrics.traversals += 1;
    const { graphId } = params(request, ['graphId']);
    const query = queryObject(request);
    allow(query, [
      'startNodeId',
      'direction',
      'relationshipType',
      'maxDepth',
      'maxNodes',
      'maxRelationships',
    ]);
    const currentUser = user(request);
    if (!store.findGraph(currentUser.id, graphId!)) notFound();
    const start =
      typeof query.startNodeId === 'string' ? query.startNodeId : '';
    if (!store.findNode(currentUser.id, graphId!, start)) notFound();
    const result = traverse(
      store.nodesFor(graphId!),
      store.relationshipsFor(graphId!),
      start,
      query,
    );
    if (result.truncated) metrics.traversalTruncations += 1;
    return result;
  });

  app.get('/v1/graphs/:graphId/data', protectedRoute(), (request) => {
    const { graphId } = params(request, ['graphId']);
    const query = queryObject(request);
    allow(query, ['cursor']);
    const graph = store.findGraph(user(request).id, graphId!);
    if (!graph) notFound();
    const nodes = page(
      store.nodesFor(graphId!),
      1_000,
      query.cursor,
      `graph-data:${graphId}`,
      config.cursorSecret,
      1_000,
    );
    const nodeIds = new Set(nodes.items.map((node) => node.id));
    const relationships = store
      .relationshipsFor(graphId!)
      .filter(
        (value) =>
          nodeIds.has(value.sourceNodeId) && nodeIds.has(value.targetNodeId),
      )
      .slice(0, 2_000);
    return {
      graph: graphRepresentation(graph),
      template: templateRepresentation(graph),
      nodes: nodes.items,
      relationships,
      page: nodes.page,
      truncated: nodes.page.hasMore || relationships.length === 2_000,
    };
  });

  app.post('/v1/graphs/:graphId/files', protectedRoute(), (request, reply) => {
    metrics.uploadAuthorizations += 1;
    const { graphId } = params(request, ['graphId']);
    const body = objectBody(request);
    allow(body, ['originalName', 'mediaType', 'sizeBytes', 'checksum']);
    const currentUser = user(request);
    const file = store.idempotent(
      currentUser.id,
      `POST /v1/graphs/${graphId}/files`,
      idempotencyKey(request),
      body,
      () =>
        store.createFile(
          currentUser.id,
          graphId!,
          body,
          request.id,
          config.maxUploadBytes,
        ),
    );
    const origin = requestOrigin(request);
    return created(reply, {
      id: file.id,
      state: file.state,
      expiresAt: file.expiresAt,
      uploadUrl: `${origin}/v1/uploads/${file.uploadToken}`,
      headers: { 'content-type': file.mediaType },
    });
  });

  app.put('/v1/uploads/:token', async (request, reply) => {
    const { token } = params(request, ['token']);
    const content = Buffer.isBuffer(request.body)
      ? request.body
      : Buffer.from(typeof request.body === 'string' ? request.body : '');
    store.uploadFile(
      token!,
      content,
      request.headers['content-type'] ?? 'application/octet-stream',
    );
    return reply.code(204).send();
  });

  app.post(
    '/v1/graphs/:graphId/files/:fileId/complete',
    protectedRoute(),
    (request) => {
      metrics.uploadCompletions += 1;
      const { graphId, fileId } = params(request, ['graphId', 'fileId']);
      return publicFile(
        store.completeFile(user(request).id, graphId!, fileId!, request.id),
      );
    },
  );

  app.get(
    '/v1/graphs/:graphId/files/:fileId/download',
    protectedRoute(),
    (request) => {
      const { graphId, fileId } = params(request, ['graphId', 'fileId']);
      const file = store.authorizeDownload(user(request).id, graphId!, fileId!);
      return {
        id: file.id,
        expiresAt: file.expiresAt,
        downloadUrl: `${requestOrigin(request)}/v1/downloads/${file.uploadToken}`,
      };
    },
  );

  app.get('/v1/downloads/:token', (request, reply) => {
    const { token } = params(request, ['token']);
    const file = store.downloadFile(token!);
    if (!file?.data) notFound();
    return reply.type(file.mediaType).send(file.data);
  });

  app.delete(
    '/v1/graphs/:graphId/files/:fileId',
    protectedRoute(),
    (request, reply) => {
      const { graphId, fileId } = params(request, ['graphId', 'fileId']);
      store.deleteFile(user(request).id, graphId!, fileId!, request.id);
      return reply.code(204).send();
    },
  );
}

const fieldProperties = [
  'key',
  'label',
  'dataType',
  'required',
  'description',
  'defaultValue',
  'displayOrder',
  'validationRules',
];

function protectedRoute(): { config: { auth: true } } {
  return { config: { auth: true } };
}
function user(request: FastifyRequest): User {
  return (request as AuthenticatedRequest).graphopperUser;
}
function publicUser(value: User): Omit<User, 'issuer' | 'subject'> {
  return {
    id: value.id,
    displayName: value.displayName,
    email: value.email,
    status: value.status,
    version: value.version,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}
function publicFile(value: {
  id: string;
  state: string;
  originalName: string;
  mediaType: string;
  sizeBytes: number;
  checksum: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}): object {
  return {
    id: value.id,
    state: value.state,
    originalName: value.originalName,
    mediaType: value.mediaType,
    sizeBytes: value.sizeBytes,
    checksum: value.checksum,
    version: value.version,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}
function graphRepresentation(graph: Graph, includeTemplate = false): object {
  return {
    id: graph.id,
    name: graph.name,
    description: graph.description,
    templateVersion: graph.templateVersion,
    version: graph.version,
    createdAt: graph.createdAt,
    updatedAt: graph.updatedAt,
    ...(includeTemplate
      ? {
          template: {
            fieldCount: graph.fields.length,
            version: graph.templateVersion,
          },
        }
      : {}),
  };
}
function templateRepresentation(graph: Graph): object {
  return {
    graphId: graph.id,
    version: graph.templateVersion,
    updatedAt: graph.updatedAt,
    fields: [...graph.fields].sort(
      (a, b) =>
        (a.displayOrder ?? Number.MAX_SAFE_INTEGER) -
          (b.displayOrder ?? Number.MAX_SAFE_INTEGER) ||
        a.id.localeCompare(b.id),
    ),
  };
}
function created(reply: FastifyReply, value: unknown): unknown {
  if (isVersioned(value)) etag(reply, value.version);
  void reply.code(201);
  return value;
}
function isVersioned(value: unknown): value is { version: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    typeof value.version === 'number'
  );
}
function etag(reply: FastifyReply, version: number): void {
  void reply
    .header('etag', `"${version}"`)
    .header('x-graphopper-api-version', 'v1');
}
function expectedVersion(request: FastifyRequest): number | undefined {
  const value = request.headers['if-match'];
  if (value === undefined) return undefined;
  const match = /^"?(\d+)"?$/u.exec(value);
  if (!match)
    throw new ApiError(
      400,
      'VALIDATION_FAILED',
      'If-Match must contain a numeric resource version.',
    );
  return Number(match[1]);
}
function requiredExpectedVersion(request: FastifyRequest): number {
  const version = expectedVersion(request);
  if (version === undefined)
    throw new ApiError(
      428,
      'VALIDATION_FAILED',
      'Template mutations require an If-Match resource version.',
    );
  return version;
}
function idempotencyKey(request: FastifyRequest): string | undefined {
  const value = request.headers['idempotency-key'];
  return typeof value === 'string' ? value : undefined;
}
function objectBody(request: FastifyRequest): Record<string, unknown> {
  if (!isRecord(request.body))
    throw new ApiError(
      400,
      'VALIDATION_FAILED',
      'The request body must be a JSON object.',
    );
  return request.body;
}
function queryObject(request: FastifyRequest): Record<string, unknown> {
  return isRecord(request.query) ? request.query : {};
}
function params(
  request: FastifyRequest,
  required: readonly string[],
): Record<string, string | undefined> {
  const value = isRecord(request.params) ? request.params : {};
  for (const key of required)
    if (typeof value[key] !== 'string' || !value[key])
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        `Path parameter ${key} is invalid.`,
      );
    else if (
      key.endsWith('Id') &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        value[key],
      )
    )
      throw new ApiError(
        400,
        'VALIDATION_FAILED',
        `Path parameter ${key} must be an opaque UUID.`,
      );
  return value as Record<string, string>;
}
function allow(
  value: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length)
    throw new ApiError(
      400,
      'VALIDATION_FAILED',
      `Unknown properties: ${unknown.join(', ')}.`,
    );
}
function recordProperty(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const child = value[key];
  if (!isRecord(child))
    throw new ApiError(400, 'VALIDATION_FAILED', `${key} must be an object.`);
  return child;
}
function requireMutation(value: Record<string, unknown>): void {
  if (!Object.keys(value).length)
    throw new ApiError(
      400,
      'VALIDATION_FAILED',
      'At least one mutable property is required.',
    );
}
function notFound(): never {
  throw new ApiError(
    404,
    'RESOURCE_NOT_FOUND',
    'The requested resource was not found.',
  );
}
function queryLimit(): never {
  throw new ApiError(
    400,
    'QUERY_LIMIT_EXCEEDED',
    'The query exceeds a configured limit.',
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function requestOrigin(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-proto'];
  const protocol =
    typeof forwarded === 'string' ? forwarded.split(',')[0]!.trim() : 'http';
  return `${protocol}://${request.headers.host ?? '127.0.0.1'}`;
}
function camelToSnake(value: string): string {
  return value.replace(/[A-Z]/gu, (match) => `_${match.toLowerCase()}`);
}
function querySignature(
  query: Record<string, unknown>,
  omitted: readonly string[],
): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(query)
        .filter(([key]) => !omitted.includes(key))
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}
function sortResources<
  T extends { id: string; createdAt: string; updatedAt: string },
>(values: T[], sort: unknown): void {
  const key =
    sort === 'updatedAt' ? 'updatedAt' : sort === 'id' ? 'id' : 'createdAt';
  values.sort(
    (a, b) =>
      String(a[key]).localeCompare(String(b[key])) || a.id.localeCompare(b.id),
  );
}
function sortNodes(
  values: NodeResource[],
  sort: unknown,
  fieldIds: ReadonlySet<string>,
): void {
  if (
    typeof sort === 'string' &&
    !['createdAt', 'updatedAt', 'id'].includes(sort)
  ) {
    if (!fieldIds.has(sort)) queryLimit();
    values.sort(
      (a, b) =>
        sortableValue(a.values[sort]).localeCompare(
          sortableValue(b.values[sort]),
        ) || a.id.localeCompare(b.id),
    );
    return;
  }
  sortResources(values, sort);
}
function sortableValue(value: unknown): string {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? String(value)
    : '';
}
function filterNodes(
  values: NodeResource[],
  raw: unknown,
  fieldIds: ReadonlySet<string>,
): NodeResource[] {
  const filters: unknown[] =
    raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  if (filters.length > 20) queryLimit();
  return filters.reduce<NodeResource[]>((current, entry) => {
    if (typeof entry !== 'string' || entry.length > 1_000) queryLimit();
    const [fieldId, operator = 'eq', encoded = ''] = entry.split(':', 3);
    if (
      !fieldId ||
      !fieldIds.has(fieldId) ||
      ![
        'eq',
        'ne',
        'exists',
        'missing',
        'gt',
        'gte',
        'lt',
        'lte',
        'contains',
        'in',
      ].includes(operator)
    )
      queryLimit();
    let expected: unknown = encoded;
    try {
      expected = JSON.parse(encoded);
    } catch {
      /* keep text */
    }
    return current.filter((node) =>
      compare(node.values[fieldId], operator, expected),
    );
  }, values);
}
function compare(
  actual: unknown,
  operator: string,
  expected: unknown,
): boolean {
  if (operator === 'exists') return actual !== undefined;
  if (operator === 'missing') return actual === undefined;
  if (operator === 'eq') return Object.is(actual, expected);
  if (operator === 'ne') return !Object.is(actual, expected);
  if (operator === 'contains')
    return (
      typeof actual === 'string' &&
      typeof expected === 'string' &&
      actual.includes(expected)
    );
  if (operator === 'in')
    return (
      Array.isArray(expected) &&
      expected.length <= 50 &&
      expected.includes(actual)
    );
  const left = typeof actual === 'number' ? actual : String(actual);
  const right = typeof expected === 'number' ? expected : String(expected);
  if (operator === 'gt') return left > right;
  if (operator === 'gte') return left >= right;
  if (operator === 'lt') return left < right;
  return left <= right;
}

function traverse(
  nodes: NodeResource[],
  relationships: Relationship[],
  start: string,
  query: Record<string, unknown>,
): {
  nodes: Array<NodeResource & { depth: number }>;
  relationships: Relationship[];
  truncated: boolean;
} {
  const direction =
    query.direction === 'incoming' || query.direction === 'outgoing'
      ? query.direction
      : 'both';
  const maxDepth = boundedInteger(query.maxDepth, 3, 1, 10);
  const maxNodes = boundedInteger(query.maxNodes, 1_000, 1, 1_000);
  const maxRelationships = boundedInteger(
    query.maxRelationships,
    2_000,
    1,
    2_000,
  );
  const types = new Set(
    (Array.isArray(query.relationshipType)
      ? query.relationshipType
      : query.relationshipType
        ? [query.relationshipType]
        : []
    ).filter((value): value is string => typeof value === 'string'),
  );
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const reached = new Map<string, number>([[start, 0]]);
  const returnedRelationships = new Map<string, Relationship>();
  const queue: Array<{ id: string; depth: number }> = [{ id: start, depth: 0 }];
  let truncated = false;
  while (queue.length) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;
    for (const relationship of relationships) {
      if (types.size && !types.has(relationship.type)) continue;
      const outgoing = relationship.sourceNodeId === current.id;
      const incoming = relationship.targetNodeId === current.id;
      if (
        (direction === 'outgoing' && !outgoing) ||
        (direction === 'incoming' && !incoming) ||
        (direction === 'both' && !outgoing && !incoming)
      )
        continue;
      const next = outgoing
        ? relationship.targetNodeId
        : relationship.sourceNodeId;
      if (!returnedRelationships.has(relationship.id)) {
        if (returnedRelationships.size >= maxRelationships) {
          truncated = true;
          break;
        }
        returnedRelationships.set(relationship.id, relationship);
      }
      if (!reached.has(next)) {
        if (reached.size >= maxNodes) {
          truncated = true;
          break;
        }
        reached.set(next, current.depth + 1);
        queue.push({ id: next, depth: current.depth + 1 });
      }
    }
    if (truncated) break;
  }
  return {
    nodes: [...reached].flatMap(([id, depth]) => {
      const node = nodeMap.get(id);
      return node ? [{ ...node, depth }] : [];
    }),
    relationships: [...returnedRelationships.values()],
    truncated,
  };
}
function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum)
    queryLimit();
  return parsed;
}
