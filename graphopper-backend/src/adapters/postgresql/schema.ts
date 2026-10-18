import type { ColumnType, Generated } from 'kysely';

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type JsonValue =
  boolean | number | string | null | JsonValue[] | { [key: string]: JsonValue };

interface Timestamped {
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface UserTable extends Timestamped {
  display_name: string | null;
  email: string | null;
  id: string;
  identity_issuer: string;
  identity_subject: string;
  status: 'active' | 'disabled';
}

export interface GraphTable extends Timestamped {
  description: string | null;
  id: string;
  name: string;
  owner_id: string;
  template_version: Generated<number>;
  version: Generated<number>;
}

export interface NodeTemplateTable {
  created_at: Generated<Timestamp>;
  graph_id: string;
  id: string;
  updated_at: Generated<Timestamp>;
}

export interface TemplateFieldTable extends Timestamped {
  data_type: string;
  default_value: JsonValue | null;
  description: string | null;
  display_order: number | null;
  graph_id: string;
  id: string;
  key: string;
  label: string;
  required: boolean;
  validation_rules: JsonValue;
  version: Generated<number>;
}

export interface NodeTable extends Timestamped {
  graph_id: string;
  id: string;
  template_version: number;
  values: JsonValue;
  version: Generated<number>;
}

export interface RelationshipTable extends Timestamped {
  graph_id: string;
  id: string;
  label: string | null;
  source_node_id: string;
  target_node_id: string;
  type: string;
  version: Generated<number>;
}

export interface FileObjectTable extends Timestamped {
  checksum: string | null;
  expires_at: Timestamp | null;
  graph_id: string | null;
  id: string;
  media_type: string | null;
  object_key: string;
  original_name: string;
  owner_id: string;
  size_bytes: number | null;
  state: 'pending' | 'ready' | 'rejected' | 'deletion_pending';
}

export interface FileReferenceTable {
  created_at: Generated<Timestamp>;
  field_id: string;
  file_id: string;
  graph_id: string;
  node_id: string;
}

export interface AuditEventTable {
  action: string;
  actor_id: string | null;
  created_at: Generated<Timestamp>;
  graph_id: string | null;
  id: string;
  outcome: string;
  request_id: string;
  resource_id: string;
  resource_type: string;
}

export interface OutboxEventTable {
  aggregate_id: string;
  aggregate_type: string;
  attempts: Generated<number>;
  available_at: Generated<Timestamp>;
  created_at: Generated<Timestamp>;
  event_type: string;
  id: string;
  last_error: string | null;
  payload: JsonValue;
  processed_at: Timestamp | null;
}

export interface IdempotencyRecordTable {
  created_at: Generated<Timestamp>;
  endpoint: string;
  expires_at: Timestamp;
  idempotency_key: string;
  request_digest: string;
  response_body: JsonValue;
  response_status: number;
  user_id: string;
}

export interface DatabaseSchema {
  audit_events: AuditEventTable;
  file_objects: FileObjectTable;
  file_references: FileReferenceTable;
  graphs: GraphTable;
  idempotency_records: IdempotencyRecordTable;
  node_templates: NodeTemplateTable;
  nodes: NodeTable;
  outbox_events: OutboxEventTable;
  relationships: RelationshipTable;
  template_fields: TemplateFieldTable;
  users: UserTable;
}
