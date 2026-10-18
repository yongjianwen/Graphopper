import type { ApplicationModule } from './module.js';
import { apiModule } from '../modules/api/index.js';
import { auditModule } from '../modules/audit/index.js';
import { authenticationModule } from '../modules/authentication/index.js';
import { authorizationModule } from '../modules/authorization/index.js';
import { filesModule } from '../modules/files/index.js';
import { graphsModule } from '../modules/graphs/index.js';
import { nodesModule } from '../modules/nodes/index.js';
import { observabilityModule } from '../modules/observability/index.js';
import { queryModule } from '../modules/query/index.js';
import { relationshipsModule } from '../modules/relationships/index.js';
import { templatesModule } from '../modules/templates/index.js';
import { traversalModule } from '../modules/traversal/index.js';
import { usersModule } from '../modules/users/index.js';

export const applicationModules: readonly ApplicationModule[] = Object.freeze([
  apiModule,
  authenticationModule,
  authorizationModule,
  usersModule,
  graphsModule,
  templatesModule,
  nodesModule,
  relationshipsModule,
  queryModule,
  traversalModule,
  filesModule,
  auditModule,
  observabilityModule,
]);
