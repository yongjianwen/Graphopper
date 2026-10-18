import { createHash, randomBytes } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';

import { ApiError } from '../modules/api/api-error.js';

export type FieldType =
  | 'text'
  | 'long_text'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'date_time'
  | 'url'
  | 'file';

interface Versioned {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface User extends Versioned {
  issuer: string;
  subject: string;
  displayName: string | null;
  email: string | null;
  status: 'active' | 'disabled';
}

export interface TemplateField extends Versioned {
  key: string;
  label: string;
  dataType: FieldType;
  required: boolean;
  description: string | null;
  defaultValue: unknown;
  displayOrder: number | null;
  validationRules: Record<string, unknown>;
}

export interface Graph extends Versioned {
  ownerId: string;
  name: string;
  description: string | null;
  templateVersion: number;
  fields: TemplateField[];
}

export interface NodeResource extends Versioned {
  graphId: string;
  templateVersion: number;
  values: Record<string, unknown>;
}

export interface Relationship extends Versioned {
  graphId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: string;
  label: string | null;
}

export interface FileObject extends Versioned {
  ownerId: string;
  graphId: string;
  originalName: string;
  mediaType: string;
  sizeBytes: number;
  checksum: string | null;
  state: 'pending' | 'ready' | 'rejected' | 'deletion_pending';
  expiresAt: string;
  uploadToken: string;
  data?: Buffer;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  graphId: string | null;
  outcome: 'success';
  requestId: string;
  createdAt: string;
}

export interface IdentityClaims {
  issuer: string;
  subject: string;
  displayName?: string | undefined;
  email?: string | undefined;
}

export interface BackendStore {
  resolveUser(claims: IdentityClaims, provision: boolean): User;
  findGraph(ownerId: string, graphId: string): Graph | undefined;
  graphsFor(ownerId: string): Graph[];
  createGraph(
    ownerId: string,
    input: Record<string, unknown>,
    requestId: string,
  ): Graph;
  updateGraph(
    ownerId: string,
    graphId: string,
    input: Record<string, unknown>,
    expected: number | undefined,
    requestId: string,
  ): Graph;
  deleteGraph(ownerId: string, graphId: string, requestId: string): boolean;
  addField(
    ownerId: string,
    graphId: string,
    input: Record<string, unknown>,
    expected: number | undefined,
    requestId: string,
    maximumNodes: number,
  ): TemplateField;
  updateField(
    ownerId: string,
    graphId: string,
    fieldId: string,
    input: Record<string, unknown>,
    expected: number | undefined,
    requestId: string,
    maximumNodes: number,
  ): TemplateField;
  deleteField(
    ownerId: string,
    graphId: string,
    fieldId: string,
    expected: number | undefined,
    confirmed: boolean,
    requestId: string,
    maximumNodes: number,
  ): boolean;
  nodesFor(graphId: string): NodeResource[];
  findNode(
    ownerId: string,
    graphId: string,
    nodeId: string,
  ): NodeResource | undefined;
  createNode(
    ownerId: string,
    graphId: string,
    values: Record<string, unknown>,
    requestId: string,
  ): NodeResource;
  updateNode(
    ownerId: string,
    graphId: string,
    nodeId: string,
    values: Record<string, unknown>,
    expected: number | undefined,
    requestId: string,
  ): NodeResource;
  deleteNode(
    ownerId: string,
    graphId: string,
    nodeId: string,
    requestId: string,
  ): boolean;
  relationshipsFor(graphId: string): Relationship[];
  findRelationship(
    ownerId: string,
    graphId: string,
    id: string,
  ): Relationship | undefined;
  createRelationship(
    ownerId: string,
    graphId: string,
    input: Record<string, unknown>,
    requestId: string,
  ): Relationship;
  updateRelationship(
    ownerId: string,
    graphId: string,
    id: string,
    input: Record<string, unknown>,
    expected: number | undefined,
    requestId: string,
  ): Relationship;
  deleteRelationship(
    ownerId: string,
    graphId: string,
    id: string,
    requestId: string,
  ): boolean;
  createFile(
    ownerId: string,
    graphId: string,
    input: Record<string, unknown>,
    requestId: string,
    maximumBytes: number,
  ): FileObject;
  findFile(
    ownerId: string,
    graphId: string,
    fileId: string,
  ): FileObject | undefined;
  findFileByUploadToken(token: string): FileObject | undefined;
  uploadFile(token: string, data: Buffer, mediaType: string): FileObject;
  completeFile(
    ownerId: string,
    graphId: string,
    fileId: string,
    requestId: string,
  ): FileObject;
  authorizeDownload(
    ownerId: string,
    graphId: string,
    fileId: string,
  ): FileObject;
  downloadFile(token: string): FileObject | undefined;
  deleteFile(
    ownerId: string,
    graphId: string,
    fileId: string,
    requestId: string,
  ): boolean;
  auditEvents(): readonly AuditEvent[];
  idempotent<T>(
    userId: string,
    endpoint: string,
    key: string | undefined,
    body: unknown,
    execute: () => T,
  ): T;
}

export class MemoryBackendStore implements BackendStore {
  private readonly users = new Map<string, User>();
  private readonly graphs = new Map<string, Graph>();
  private readonly nodes = new Map<string, NodeResource>();
  private readonly relationships = new Map<string, Relationship>();
  private readonly files = new Map<string, FileObject>();
  private readonly audits: AuditEvent[] = [];
  private readonly idempotency = new Map<
    string,
    { digest: string; response: unknown }
  >();

  resolveUser(claims: IdentityClaims, provision: boolean): User {
    const key = `${claims.issuer}\u0000${claims.subject}`;
    const existing = this.users.get(key);
    if (existing) {
      if (existing.status !== 'active')
        throw new ApiError(
          401,
          'TOKEN_INVALID',
          'The local account is disabled.',
        );
      return clone(existing);
    }
    if (!provision)
      throw new ApiError(
        401,
        'TOKEN_INVALID',
        'The authenticated identity is not registered.',
      );
    const now = timestamp();
    const user: User = {
      id: uuidv7(),
      issuer: claims.issuer,
      subject: claims.subject,
      displayName: claims.displayName ?? null,
      email: claims.email ?? null,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(key, user);
    return clone(user);
  }

  findGraph(ownerId: string, graphId: string): Graph | undefined {
    const graph = this.graphs.get(graphId);
    return graph?.ownerId === ownerId ? clone(graph) : undefined;
  }

  graphsFor(ownerId: string): Graph[] {
    return [...this.graphs.values()]
      .filter((graph) => graph.ownerId === ownerId)
      .sort(byCreatedAndId)
      .map(clone);
  }

  createGraph(
    ownerId: string,
    input: Record<string, unknown>,
    requestId: string,
  ): Graph {
    const name = requiredString(input, 'name', 200);
    const description = optionalString(input.description, 5_000);
    const now = timestamp();
    const graph: Graph = {
      id: uuidv7(),
      ownerId,
      name,
      description,
      templateVersion: 0,
      fields: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const initialFields = Array.isArray(input.templateFields)
      ? input.templateFields
      : [];
    for (const value of initialFields) {
      if (!isRecord(value))
        invalid('templateFields', 'Each template field must be an object.');
      graph.fields.push(makeField(value));
    }
    ensureUniqueKeys(graph.fields);
    graph.templateVersion = graph.fields.length ? 1 : 0;
    this.graphs.set(graph.id, graph);
    this.audit(ownerId, 'graph.create', 'graph', graph.id, graph.id, requestId);
    return clone(graph);
  }

  updateGraph(
    ownerId: string,
    graphId: string,
    input: Record<string, unknown>,
    expected: number | undefined,
    requestId: string,
  ): Graph {
    const current = this.ownedGraph(ownerId, graphId);
    checkVersion(current, expected);
    const graph = clone(current);
    if ('name' in input) graph.name = requiredString(input, 'name', 200);
    if ('description' in input)
      graph.description = optionalString(input.description, 5_000);
    touch(graph);
    this.graphs.set(graph.id, graph);
    this.audit(ownerId, 'graph.update', 'graph', graph.id, graph.id, requestId);
    return clone(graph);
  }

  deleteGraph(ownerId: string, graphId: string, requestId: string): boolean {
    const graph = this.graphs.get(graphId);
    if (!graph || graph.ownerId !== ownerId) return false;
    for (const node of this.nodesFor(graphId)) this.nodes.delete(node.id);
    for (const relationship of this.relationshipsFor(graphId))
      this.relationships.delete(relationship.id);
    for (const file of this.files.values())
      if (file.graphId === graphId) file.state = 'deletion_pending';
    this.graphs.delete(graphId);
    this.audit(ownerId, 'graph.delete', 'graph', graphId, graphId, requestId);
    return true;
  }

  addField(
    ownerId: string,
    graphId: string,
    input: Record<string, unknown>,
    expected: number | undefined,
    requestId: string,
    maximumNodes: number,
  ): TemplateField {
    const current = this.ownedGraph(ownerId, graphId);
    checkVersion(current, expected);
    const graph = clone(current);
    const nodes = this.nodesFor(graphId);
    const field = makeField(input);
    ensureUniqueKeys([...graph.fields, field]);
    const materializesValues =
      field.required || input.materializeDefault === true;
    if (materializesValues) migrationLimit(nodes.length, maximumNodes);
    if (field.required && nodes.length && field.defaultValue === undefined)
      throw new ApiError(
        409,
        'TEMPLATE_CONFLICT',
        'A required field on a populated graph needs a default value.',
      );
    if (materializesValues)
      for (const node of nodes) {
        if (field.defaultValue !== undefined)
          node.values[field.id] = clone(field.defaultValue);
        node.templateVersion = graph.templateVersion + 1;
        touch(node);
        this.nodes.set(node.id, node);
      }
    graph.fields.push(field);
    bumpTemplate(graph);
    this.graphs.set(graph.id, graph);
    this.audit(
      ownerId,
      'template.field.add',
      'templateField',
      field.id,
      graphId,
      requestId,
    );
    return clone(field);
  }

  updateField(
    ownerId: string,
    graphId: string,
    fieldId: string,
    input: Record<string, unknown>,
    expected: number | undefined,
    requestId: string,
    maximumNodes: number,
  ): TemplateField {
    const current = this.ownedGraph(ownerId, graphId);
    checkVersion(current, expected);
    const graph = clone(current);
    const field = graph.fields.find((candidate) => candidate.id === fieldId);
    if (!field) notFound();
    const nodes = this.nodesFor(graphId);
    const previousType = field.dataType;
    const previousRequired = field.required;
    if ('key' in input) field.key = fieldKey(input.key);
    if ('label' in input) field.label = requiredString(input, 'label', 200);
    if ('description' in input)
      field.description = optionalString(input.description, 2_000);
    if ('displayOrder' in input)
      field.displayOrder = optionalInteger(input.displayOrder);
    if ('validationRules' in input)
      field.validationRules = rules(input.validationRules);
    if ('defaultValue' in input) field.defaultValue = input.defaultValue;
    if ('required' in input)
      field.required = requiredBoolean(input.required, 'required');
    if ('dataType' in input) field.dataType = dataType(input.dataType);
    ensureUniqueKeys(graph.fields);
    if (field.defaultValue !== undefined)
      validateFieldValue(field, field.defaultValue);
    const migratesValues =
      field.dataType !== previousType ||
      (!previousRequired && field.required) ||
      'validationRules' in input;
    if (migratesValues) migrationLimit(nodes.length, maximumNodes);
    if (field.dataType !== previousType) {
      if (input.conversionPolicy !== 'safe')
        throw new ApiError(
          409,
          'TEMPLATE_CONFLICT',
          'Changing a field type requires conversionPolicy=safe.',
        );
      for (const node of nodes)
        if (field.id in node.values)
          node.values[field.id] = convert(
            node.values[field.id],
            field.dataType,
            field.id,
          );
    }
    if (!previousRequired && field.required)
      for (const node of nodes) {
        if (!(field.id in node.values) || node.values[field.id] === null) {
          if (field.defaultValue === undefined)
            throw new ApiError(
              409,
              'TEMPLATE_CONFLICT',
              'Every node must have a value before the field can become required.',
            );
          node.values[field.id] = clone(field.defaultValue);
        }
      }
    if (migratesValues)
      for (const node of nodes) {
        node.values = validateValues(graph.fields, node.values, false);
        node.templateVersion = graph.templateVersion + 1;
        touch(node);
      }
    touch(field);
    bumpTemplate(graph);
    this.graphs.set(graph.id, graph);
    if (migratesValues) for (const node of nodes) this.nodes.set(node.id, node);
    this.audit(
      ownerId,
      'template.field.update',
      'templateField',
      field.id,
      graphId,
      requestId,
    );
    return clone(field);
  }

  deleteField(
    ownerId: string,
    graphId: string,
    fieldId: string,
    expected: number | undefined,
    confirmed: boolean,
    requestId: string,
    maximumNodes: number,
  ): boolean {
    const current = this.ownedGraph(ownerId, graphId);
    checkVersion(current, expected);
    const graph = clone(current);
    const index = graph.fields.findIndex((field) => field.id === fieldId);
    if (index < 0) return false;
    if (!confirmed)
      throw new ApiError(
        409,
        'TEMPLATE_CONFLICT',
        'Field deletion requires destructiveConfirmation=true.',
      );
    const nodes = this.nodesFor(graphId);
    migrationLimit(nodes.length, maximumNodes);
    const removedFileIds = new Set<string>();
    for (const node of nodes) {
      const previousValue = node.values[fieldId];
      if (typeof previousValue === 'string' && this.files.has(previousValue))
        removedFileIds.add(previousValue);
      delete node.values[fieldId];
      node.templateVersion = graph.templateVersion + 1;
      touch(node);
    }
    graph.fields.splice(index, 1);
    bumpTemplate(graph);
    this.graphs.set(graph.id, graph);
    for (const node of nodes) this.nodes.set(node.id, node);
    this.markFilesOrphaned(graphId, removedFileIds);
    this.audit(
      ownerId,
      'template.field.delete',
      'templateField',
      fieldId,
      graphId,
      requestId,
    );
    return true;
  }

  nodesFor(graphId: string): NodeResource[] {
    return [...this.nodes.values()]
      .filter((node) => node.graphId === graphId)
      .sort(byCreatedAndId)
      .map(clone);
  }
  findNode(
    ownerId: string,
    graphId: string,
    nodeId: string,
  ): NodeResource | undefined {
    if (!this.findGraph(ownerId, graphId)) return undefined;
    const node = this.nodes.get(nodeId);
    return node?.graphId === graphId ? clone(node) : undefined;
  }
  createNode(
    ownerId: string,
    graphId: string,
    values: Record<string, unknown>,
    requestId: string,
  ): NodeResource {
    const graph = this.ownedGraph(ownerId, graphId);
    const now = timestamp();
    const node: NodeResource = {
      id: uuidv7(),
      graphId,
      templateVersion: graph.templateVersion,
      values: validateValues(graph.fields, values, true),
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.assertFiles(ownerId, graph, node.values);
    this.nodes.set(node.id, node);
    this.audit(ownerId, 'node.create', 'node', node.id, graphId, requestId);
    return clone(node);
  }
  updateNode(
    ownerId: string,
    graphId: string,
    nodeId: string,
    values: Record<string, unknown>,
    expected: number | undefined,
    requestId: string,
  ): NodeResource {
    const graph = this.ownedGraph(ownerId, graphId);
    const current = this.nodes.get(nodeId);
    if (!current || current.graphId !== graphId) notFound();
    checkVersion(current, expected);
    const node = clone(current);
    const previousFileIds = this.fileIds(node.values);
    const candidate = { ...node.values };
    for (const [key, value] of Object.entries(values)) {
      if (value === null) delete candidate[key];
      else candidate[key] = value;
    }
    node.values = validateValues(graph.fields, candidate, false);
    this.assertFiles(ownerId, graph, node.values);
    node.templateVersion = graph.templateVersion;
    touch(node);
    this.nodes.set(node.id, node);
    this.audit(ownerId, 'node.update', 'node', node.id, graphId, requestId);
    const currentFileIds = this.fileIds(node.values);
    this.markFilesOrphaned(
      graphId,
      new Set([...previousFileIds].filter((id) => !currentFileIds.has(id))),
    );
    return clone(node);
  }
  deleteNode(
    ownerId: string,
    graphId: string,
    nodeId: string,
    requestId: string,
  ): boolean {
    this.ownedGraph(ownerId, graphId);
    const node = this.nodes.get(nodeId);
    if (!node || node.graphId !== graphId) return false;
    const removedFileIds = this.fileIds(node.values);
    this.nodes.delete(nodeId);
    for (const relation of this.relationshipsFor(graphId))
      if (relation.sourceNodeId === nodeId || relation.targetNodeId === nodeId)
        this.relationships.delete(relation.id);
    this.markFilesOrphaned(graphId, removedFileIds);
    this.audit(ownerId, 'node.delete', 'node', nodeId, graphId, requestId);
    return true;
  }

  relationshipsFor(graphId: string): Relationship[] {
    return [...this.relationships.values()]
      .filter((value) => value.graphId === graphId)
      .sort(byCreatedAndId)
      .map(clone);
  }
  findRelationship(
    ownerId: string,
    graphId: string,
    id: string,
  ): Relationship | undefined {
    if (!this.findGraph(ownerId, graphId)) return undefined;
    const value = this.relationships.get(id);
    return value?.graphId === graphId ? clone(value) : undefined;
  }
  createRelationship(
    ownerId: string,
    graphId: string,
    input: Record<string, unknown>,
    requestId: string,
  ): Relationship {
    this.ownedGraph(ownerId, graphId);
    const sourceNodeId = requiredString(input, 'sourceNodeId', 100);
    const targetNodeId = requiredString(input, 'targetNodeId', 100);
    if (
      !this.findNode(ownerId, graphId, sourceNodeId) ||
      !this.findNode(ownerId, graphId, targetNodeId)
    )
      notFound();
    const now = timestamp();
    const relationship: Relationship = {
      id: uuidv7(),
      graphId,
      sourceNodeId,
      targetNodeId,
      type: requiredString(input, 'type', 100),
      label: optionalString(input.label, 500),
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.relationships.set(relationship.id, relationship);
    this.audit(
      ownerId,
      'relationship.create',
      'relationship',
      relationship.id,
      graphId,
      requestId,
    );
    return clone(relationship);
  }
  updateRelationship(
    ownerId: string,
    graphId: string,
    id: string,
    input: Record<string, unknown>,
    expected: number | undefined,
    requestId: string,
  ): Relationship {
    this.ownedGraph(ownerId, graphId);
    const current = this.relationships.get(id);
    if (!current || current.graphId !== graphId) notFound();
    checkVersion(current, expected);
    const relationship = clone(current);
    if ('type' in input) relationship.type = requiredString(input, 'type', 100);
    if ('label' in input) relationship.label = optionalString(input.label, 500);
    touch(relationship);
    this.relationships.set(id, relationship);
    this.audit(
      ownerId,
      'relationship.update',
      'relationship',
      id,
      graphId,
      requestId,
    );
    return clone(relationship);
  }
  deleteRelationship(
    ownerId: string,
    graphId: string,
    id: string,
    requestId: string,
  ): boolean {
    this.ownedGraph(ownerId, graphId);
    const relationship = this.relationships.get(id);
    if (!relationship || relationship.graphId !== graphId) return false;
    this.relationships.delete(id);
    this.audit(
      ownerId,
      'relationship.delete',
      'relationship',
      id,
      graphId,
      requestId,
    );
    return true;
  }

  createFile(
    ownerId: string,
    graphId: string,
    input: Record<string, unknown>,
    requestId: string,
    maximumBytes: number,
  ): FileObject {
    this.ownedGraph(ownerId, graphId);
    const mediaType = requiredString(input, 'mediaType', 200);
    if (
      !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(
        mediaType,
      )
    )
      invalid('mediaType', 'Unsupported media type.');
    const sizeBytes = requiredInteger(input.sizeBytes, 'sizeBytes');
    if (sizeBytes > maximumBytes)
      invalid('sizeBytes', `Files may not exceed ${maximumBytes} bytes.`);
    const now = timestamp();
    const file: FileObject = {
      id: uuidv7(),
      ownerId,
      graphId,
      originalName: requiredString(input, 'originalName', 500),
      mediaType,
      sizeBytes,
      checksum: typeof input.checksum === 'string' ? input.checksum : null,
      state: 'pending',
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      uploadToken: randomBytes(24).toString('base64url'),
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.files.set(file.id, file);
    this.audit(ownerId, 'file.authorize', 'file', file.id, graphId, requestId);
    return clone(file);
  }
  findFile(
    ownerId: string,
    graphId: string,
    fileId: string,
  ): FileObject | undefined {
    const file = this.files.get(fileId);
    return file?.ownerId === ownerId && file.graphId === graphId
      ? clone(file)
      : undefined;
  }
  findFileByUploadToken(token: string): FileObject | undefined {
    const file = [...this.files.values()].find(
      (candidate) =>
        candidate.uploadToken === token && candidate.state === 'pending',
    );
    return file ? clone(file) : undefined;
  }
  uploadFile(token: string, data: Buffer, mediaType: string): FileObject {
    const file = [...this.files.values()].find(
      (candidate) =>
        candidate.uploadToken === token && candidate.state === 'pending',
    );
    if (!file || Date.parse(file.expiresAt) < Date.now()) notFound();
    const checksum = createHash('sha256').update(data).digest('hex');
    if (
      data.length !== file.sizeBytes ||
      mediaType !== file.mediaType ||
      (file.checksum !== null && file.checksum !== checksum)
    ) {
      file.state = 'rejected';
      throw new ApiError(
        422,
        'VALIDATION_FAILED',
        'Uploaded object metadata does not match the authorization.',
      );
    }
    file.data = Buffer.from(data);
    file.checksum = checksum;
    touch(file);
    return clone(file);
  }
  completeFile(
    ownerId: string,
    graphId: string,
    fileId: string,
    requestId: string,
  ): FileObject {
    const file = this.files.get(fileId);
    if (!file || file.ownerId !== ownerId || file.graphId !== graphId)
      notFound();
    if (file.state !== 'pending' || !file.data)
      throw new ApiError(
        409,
        'FILE_NOT_READY',
        'The uploaded object is not ready for finalization.',
      );
    file.state = 'ready';
    file.uploadToken = '';
    touch(file);
    this.audit(ownerId, 'file.complete', 'file', file.id, graphId, requestId);
    return clone(file);
  }
  authorizeDownload(
    ownerId: string,
    graphId: string,
    fileId: string,
  ): FileObject {
    const file = this.files.get(fileId);
    if (!file || file.ownerId !== ownerId || file.graphId !== graphId)
      notFound();
    if (file.state !== 'ready' || !file.data)
      throw new ApiError(
        409,
        'FILE_NOT_READY',
        'The managed file is not ready.',
      );
    file.uploadToken = randomBytes(24).toString('base64url');
    file.expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    return clone(file);
  }
  downloadFile(token: string): FileObject | undefined {
    const file = [...this.files.values()].find(
      (candidate) =>
        candidate.uploadToken === token &&
        candidate.state === 'ready' &&
        Date.parse(candidate.expiresAt) >= Date.now(),
    );
    return file ? clone(file) : undefined;
  }
  deleteFile(
    ownerId: string,
    graphId: string,
    fileId: string,
    requestId: string,
  ): boolean {
    const file = this.files.get(fileId);
    if (!file || file.ownerId !== ownerId || file.graphId !== graphId)
      return false;
    if (this.isFileReferenced(graphId, fileId))
      throw new ApiError(
        409,
        'TEMPLATE_CONFLICT',
        'A referenced file cannot be deleted.',
      );
    file.state = 'deletion_pending';
    delete file.data;
    this.audit(ownerId, 'file.delete', 'file', file.id, graphId, requestId);
    return true;
  }

  auditEvents(): readonly AuditEvent[] {
    return this.audits.map(clone);
  }
  idempotent<T>(
    userId: string,
    endpoint: string,
    key: string | undefined,
    body: unknown,
    execute: () => T,
  ): T {
    if (!key) return execute();
    if (key.length > 200)
      invalid('idempotency-key', 'Idempotency key is too long.');
    const scoped = `${userId}\u0000${endpoint}\u0000${key}`;
    const digest = createHash('sha256').update(stableJson(body)).digest('hex');
    const existing = this.idempotency.get(scoped);
    if (existing) {
      if (existing.digest !== digest)
        throw new ApiError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'The idempotency key was already used with a different request.',
        );
      return clone(existing.response as T);
    }
    const response = execute();
    this.idempotency.set(scoped, { digest, response: clone(response) });
    return response;
  }

  private ownedGraph(ownerId: string, graphId: string): Graph {
    const graph = this.graphs.get(graphId);
    if (!graph || graph.ownerId !== ownerId) notFound();
    return graph;
  }
  private assertFiles(
    ownerId: string,
    graph: Graph,
    values: Record<string, unknown>,
  ): void {
    for (const field of graph.fields.filter(
      (candidate) => candidate.dataType === 'file',
    )) {
      const value = values[field.id];
      if (value === undefined) continue;
      if (typeof value === 'string' && /^https:\/\//u.test(value)) continue;
      const file =
        typeof value === 'string' ? this.files.get(value) : undefined;
      if (!file || file.ownerId !== ownerId || file.graphId !== graph.id)
        notFound();
      if (file.state !== 'ready')
        throw new ApiError(
          409,
          'FILE_NOT_READY',
          'The managed file is not ready.',
        );
    }
  }
  private isFileReferenced(graphId: string, fileId: string): boolean {
    return this.nodesFor(graphId).some((node) =>
      Object.values(node.values).includes(fileId),
    );
  }
  private fileIds(values: Record<string, unknown>): Set<string> {
    return new Set(
      Object.values(values).filter(
        (value): value is string =>
          typeof value === 'string' && this.files.has(value),
      ),
    );
  }
  private markFilesOrphaned(
    graphId: string,
    candidateIds: ReadonlySet<string>,
  ): void {
    for (const fileId of candidateIds) {
      const file = this.files.get(fileId);
      if (
        file?.graphId === graphId &&
        file.state === 'ready' &&
        !this.isFileReferenced(graphId, file.id)
      )
        file.state = 'deletion_pending';
    }
  }
  private audit(
    actorId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    graphId: string | null,
    requestId: string,
  ): void {
    this.audits.push({
      id: uuidv7(),
      actorId,
      action,
      resourceType,
      resourceId,
      graphId,
      outcome: 'success',
      requestId,
      createdAt: timestamp(),
    });
  }
}

function makeField(input: Record<string, unknown>): TemplateField {
  const now = timestamp();
  const field: TemplateField = {
    id: uuidv7(),
    key: fieldKey(input.key),
    label: requiredString(input, 'label', 200),
    dataType: dataType(input.dataType),
    required:
      input.required === undefined
        ? false
        : requiredBoolean(input.required, 'required'),
    description: optionalString(input.description, 2_000),
    defaultValue: input.defaultValue,
    displayOrder: optionalInteger(input.displayOrder),
    validationRules: rules(input.validationRules),
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  if (field.defaultValue !== undefined)
    validateFieldValue(field, field.defaultValue);
  return field;
}

export function validateValues(
  fields: readonly TemplateField[],
  input: Record<string, unknown>,
  applyDefaults: boolean,
): Record<string, unknown> {
  const known = new Map(fields.map((field) => [field.id, field]));
  for (const id of Object.keys(input))
    if (!known.has(id))
      invalid(id, 'Unknown template field identifier.', 'NODE_VALUE_INVALID');
  const output: Record<string, unknown> = {};
  for (const field of fields) {
    let value = input[field.id];
    if (value === undefined && applyDefaults) value = field.defaultValue;
    if (value === undefined || value === null) {
      if (field.required)
        invalid(field.id, 'A value is required.', 'NODE_VALUE_INVALID');
      continue;
    }
    validateFieldValue(field, value);
    output[field.id] = canonical(value, field.dataType);
  }
  return output;
}

function validateFieldValue(field: TemplateField, value: unknown): void {
  let canonicalValue: unknown;
  try {
    canonicalValue = canonical(value, field.dataType);
  } catch {
    invalid(
      field.id,
      `Expected a canonical ${field.dataType} value.`,
      'NODE_VALUE_INVALID',
    );
  }
  const rule = field.validationRules;
  if (typeof canonicalValue === 'string') {
    if (
      typeof rule.minLength === 'number' &&
      canonicalValue.length < rule.minLength
    )
      invalid(
        field.id,
        `Minimum length is ${rule.minLength}.`,
        'NODE_VALUE_INVALID',
      );
    if (
      typeof rule.maxLength === 'number' &&
      canonicalValue.length > rule.maxLength
    )
      invalid(
        field.id,
        `Maximum length is ${rule.maxLength}.`,
        'NODE_VALUE_INVALID',
      );
    if (Array.isArray(rule.enum) && !rule.enum.includes(canonicalValue))
      invalid(
        field.id,
        'Value is not in the allowed enumeration.',
        'NODE_VALUE_INVALID',
      );
    if (typeof rule.pattern === 'string') {
      if (rule.pattern.length > 100)
        invalid(
          field.id,
          'Validation pattern is too long.',
          'NODE_VALUE_INVALID',
        );
      try {
        if (!new RegExp(rule.pattern, 'u').test(canonicalValue))
          invalid(
            field.id,
            'Value does not match the configured pattern.',
            'NODE_VALUE_INVALID',
          );
      } catch {
        invalid(
          field.id,
          'Validation pattern is invalid.',
          'NODE_VALUE_INVALID',
        );
      }
    }
  }
  if (typeof canonicalValue === 'number') {
    if (typeof rule.minimum === 'number' && canonicalValue < rule.minimum)
      invalid(
        field.id,
        `Minimum value is ${rule.minimum}.`,
        'NODE_VALUE_INVALID',
      );
    if (typeof rule.maximum === 'number' && canonicalValue > rule.maximum)
      invalid(
        field.id,
        `Maximum value is ${rule.maximum}.`,
        'NODE_VALUE_INVALID',
      );
  }
}

function canonical(value: unknown, type: FieldType): unknown {
  if (type === 'boolean') {
    if (typeof value !== 'boolean') typeError();
    return value;
  }
  if (type === 'integer') {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) typeError();
    return value;
  }
  if (type === 'decimal') {
    if (
      (typeof value !== 'number' || !Number.isFinite(value)) &&
      (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/u.test(value))
    )
      typeError();
    return typeof value === 'number' ? String(value) : value;
  }
  if (typeof value !== 'string') typeError();
  if (type === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) typeError();
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.valueOf()) ||
      parsed.toISOString().slice(0, 10) !== value
    )
      typeError();
  }
  if (type === 'date_time' && Number.isNaN(Date.parse(value))) typeError();
  if (type === 'url') {
    const url = new URL(value);
    if (url.protocol !== 'https:') typeError();
  }
  return value;
}

function convert(value: unknown, target: FieldType, fieldId: string): unknown {
  try {
    if (target === 'text' || target === 'long_text') return String(value);
    if (target === 'integer') {
      const number = Number(value);
      if (!Number.isSafeInteger(number)) typeError();
      return number;
    }
    if (target === 'decimal') {
      const number = Number(value);
      if (!Number.isFinite(number)) typeError();
      return String(value);
    }
    if (
      target === 'boolean' &&
      (value === true ||
        value === false ||
        value === 'true' ||
        value === 'false')
    )
      return value === true || value === 'true';
    return canonical(value, target);
  } catch {
    invalid(
      fieldId,
      `Value cannot be converted safely to ${target}.`,
      'NODE_VALUE_INVALID',
    );
  }
}

function requiredString(
  input: Record<string, unknown>,
  key: string,
  maximum: number,
): string {
  const value = input[key];
  if (typeof value !== 'string' || !value.trim() || value.length > maximum)
    invalid(
      key,
      `Must be a non-empty string of at most ${maximum} characters.`,
    );
  return value.trim();
}
function optionalString(value: unknown, maximum: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > maximum)
    invalid('value', `Must be a string of at most ${maximum} characters.`);
  return value;
}
function requiredBoolean(value: unknown, key: string): boolean {
  if (typeof value !== 'boolean') invalid(key, 'Must be a Boolean.');
  return value;
}
function requiredInteger(value: unknown, key: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    invalid(key, 'Must be a non-negative integer.');
  return value;
}
function optionalInteger(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  return requiredInteger(value, 'displayOrder');
}
function rules(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (!isRecord(value)) invalid('validationRules', 'Must be an object.');
  return clone(value);
}
function fieldKey(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[a-z][a-z0-9_]*$/u.test(value) ||
    ['id', 'graph_id', 'created_at', 'updated_at'].includes(value)
  )
    invalid('key', 'Field key is invalid or reserved.');
  return value;
}
function dataType(value: unknown): FieldType {
  const allowed: FieldType[] = [
    'text',
    'long_text',
    'integer',
    'decimal',
    'boolean',
    'date',
    'date_time',
    'url',
    'file',
  ];
  if (!allowed.includes(value as FieldType))
    invalid('dataType', 'Unsupported field data type.');
  return value as FieldType;
}
function ensureUniqueKeys(fields: readonly TemplateField[]): void {
  if (new Set(fields.map((field) => field.key)).size !== fields.length)
    throw new ApiError(
      409,
      'TEMPLATE_CONFLICT',
      'Template field keys must be unique.',
    );
}
function checkVersion(
  value: { version: number },
  expected: number | undefined,
): void {
  if (expected !== undefined && expected !== value.version)
    throw new ApiError(
      412,
      'RESOURCE_VERSION_MISMATCH',
      'The resource version does not match If-Match.',
    );
}
function migrationLimit(count: number, maximum: number): void {
  if (count > maximum)
    throw new ApiError(
      409,
      'TEMPLATE_MIGRATION_TOO_LARGE',
      'The template mutation exceeds the synchronous node limit.',
    );
}
function bumpTemplate(graph: Graph): void {
  graph.templateVersion += 1;
  touch(graph);
}
function touch(value: Versioned): void {
  value.version += 1;
  value.updatedAt = timestamp();
}
function timestamp(): string {
  return new Date().toISOString();
}
function byCreatedAndId(a: Versioned, b: Versioned): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}
function clone<T>(value: T): T {
  return structuredClone(value);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
function typeError(): never {
  throw new Error('TYPE_INVALID');
}
function invalid(
  fieldId: string,
  reason: string,
  code: 'VALIDATION_FAILED' | 'NODE_VALUE_INVALID' = 'VALIDATION_FAILED',
): never {
  throw new ApiError(
    422,
    code,
    code === 'NODE_VALUE_INVALID'
      ? 'One or more node values are invalid.'
      : 'The request is invalid.',
    [{ fieldId, reason }],
  );
}
function notFound(): never {
  throw new ApiError(
    404,
    'RESOURCE_NOT_FOUND',
    'The requested resource was not found.',
  );
}
