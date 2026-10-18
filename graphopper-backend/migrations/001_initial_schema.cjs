exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE users (
      id uuid PRIMARY KEY,
      identity_issuer text NOT NULL,
      identity_subject text NOT NULL,
      display_name text,
      email text,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT users_external_identity_unique UNIQUE (identity_issuer, identity_subject),
      CONSTRAINT users_timestamps_ordered CHECK (updated_at >= created_at)
    );

    CREATE TABLE graphs (
      id uuid PRIMARY KEY,
      owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      name text NOT NULL CHECK (length(btrim(name)) > 0),
      description text,
      template_version bigint NOT NULL DEFAULT 0 CHECK (template_version >= 0),
      version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT graphs_timestamps_ordered CHECK (updated_at >= created_at)
    );

    CREATE INDEX graphs_owner_created_id_idx ON graphs(owner_id, created_at, id);
    CREATE INDEX graphs_owner_name_id_idx ON graphs(owner_id, name, id);

    CREATE TABLE node_templates (
      id uuid PRIMARY KEY,
      graph_id uuid NOT NULL UNIQUE REFERENCES graphs(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT node_templates_timestamps_ordered CHECK (updated_at >= created_at)
    );

    CREATE TABLE template_fields (
      id uuid PRIMARY KEY,
      graph_id uuid NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
      key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]*$'),
      label text NOT NULL CHECK (length(btrim(label)) > 0),
      data_type text NOT NULL CHECK (
        data_type IN ('text', 'long_text', 'integer', 'decimal', 'boolean', 'date', 'date_time', 'url', 'file')
      ),
      required boolean NOT NULL DEFAULT false,
      description text,
      default_value jsonb,
      validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(validation_rules) = 'object'),
      display_order integer CHECK (display_order IS NULL OR display_order >= 0),
      version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT template_fields_graph_key_unique UNIQUE (graph_id, key),
      CONSTRAINT template_fields_graph_id_id_unique UNIQUE (graph_id, id),
      CONSTRAINT template_fields_timestamps_ordered CHECK (updated_at >= created_at)
    );

    CREATE INDEX template_fields_graph_order_id_idx ON template_fields(graph_id, display_order, id);

    CREATE TABLE nodes (
      id uuid PRIMARY KEY,
      graph_id uuid NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
      template_version bigint NOT NULL CHECK (template_version >= 0),
      values jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(values) = 'object'),
      version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT nodes_graph_id_id_unique UNIQUE (graph_id, id),
      CONSTRAINT nodes_timestamps_ordered CHECK (updated_at >= created_at)
    );

    CREATE INDEX nodes_graph_created_id_idx ON nodes(graph_id, created_at, id);
    CREATE INDEX nodes_values_gin_idx ON nodes USING gin(values);

    CREATE TABLE relationships (
      id uuid PRIMARY KEY,
      graph_id uuid NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
      source_node_id uuid NOT NULL,
      target_node_id uuid NOT NULL,
      type text NOT NULL CHECK (length(btrim(type)) > 0),
      label text,
      version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT relationships_source_same_graph_fk
        FOREIGN KEY (graph_id, source_node_id) REFERENCES nodes(graph_id, id) ON DELETE CASCADE,
      CONSTRAINT relationships_target_same_graph_fk
        FOREIGN KEY (graph_id, target_node_id) REFERENCES nodes(graph_id, id) ON DELETE CASCADE,
      CONSTRAINT relationships_timestamps_ordered CHECK (updated_at >= created_at)
    );

    CREATE INDEX relationships_graph_source_type_id_idx
      ON relationships(graph_id, source_node_id, type, id);
    CREATE INDEX relationships_graph_target_type_id_idx
      ON relationships(graph_id, target_node_id, type, id);
    CREATE INDEX relationships_graph_type_id_idx ON relationships(graph_id, type, id);

    CREATE TABLE file_objects (
      id uuid PRIMARY KEY,
      owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      graph_id uuid REFERENCES graphs(id) ON DELETE SET NULL,
      object_key text NOT NULL UNIQUE CHECK (length(btrim(object_key)) > 0),
      state text NOT NULL CHECK (state IN ('pending', 'ready', 'rejected', 'deletion_pending')),
      original_name text NOT NULL CHECK (length(btrim(original_name)) > 0),
      media_type text,
      size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
      checksum text,
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT file_objects_graph_id_id_unique UNIQUE (graph_id, id),
      CONSTRAINT file_objects_graph_lifecycle CHECK (graph_id IS NOT NULL OR state = 'deletion_pending'),
      CONSTRAINT file_objects_timestamps_ordered CHECK (updated_at >= created_at)
    );

    CREATE INDEX file_objects_pending_expiry_idx ON file_objects(state, expires_at)
      WHERE state = 'pending';
    CREATE INDEX file_objects_owner_graph_id_idx ON file_objects(owner_id, graph_id, id);

    CREATE TABLE file_references (
      file_id uuid NOT NULL,
      node_id uuid NOT NULL,
      field_id uuid NOT NULL,
      graph_id uuid NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (file_id, node_id, field_id),
      CONSTRAINT file_references_file_same_graph_fk
        FOREIGN KEY (graph_id, file_id) REFERENCES file_objects(graph_id, id) ON DELETE CASCADE,
      CONSTRAINT file_references_node_same_graph_fk
        FOREIGN KEY (graph_id, node_id) REFERENCES nodes(graph_id, id) ON DELETE CASCADE,
      CONSTRAINT file_references_field_same_graph_fk
        FOREIGN KEY (graph_id, field_id) REFERENCES template_fields(graph_id, id) ON DELETE CASCADE
    );

    CREATE INDEX file_references_node_field_idx ON file_references(node_id, field_id);

    CREATE TABLE audit_events (
      id uuid PRIMARY KEY,
      actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
      action text NOT NULL CHECK (length(btrim(action)) > 0),
      resource_type text NOT NULL CHECK (length(btrim(resource_type)) > 0),
      resource_id uuid NOT NULL,
      graph_id uuid,
      outcome text NOT NULL CHECK (length(btrim(outcome)) > 0),
      request_id text NOT NULL CHECK (length(btrim(request_id)) > 0),
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX audit_events_actor_created_idx ON audit_events(actor_id, created_at, id);
    CREATE INDEX audit_events_graph_created_idx ON audit_events(graph_id, created_at, id);
    CREATE INDEX audit_events_request_id_idx ON audit_events(request_id);

    CREATE TABLE outbox_events (
      id uuid PRIMARY KEY,
      event_type text NOT NULL CHECK (length(btrim(event_type)) > 0),
      aggregate_type text NOT NULL CHECK (length(btrim(aggregate_type)) > 0),
      aggregate_id uuid NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
      attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      available_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at timestamptz,
      last_error text,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX outbox_events_ready_idx ON outbox_events(available_at, created_at, id)
      WHERE processed_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS outbox_events;
    DROP TABLE IF EXISTS audit_events;
    DROP TABLE IF EXISTS file_references;
    DROP TABLE IF EXISTS file_objects;
    DROP TABLE IF EXISTS relationships;
    DROP TABLE IF EXISTS nodes;
    DROP TABLE IF EXISTS template_fields;
    DROP TABLE IF EXISTS node_templates;
    DROP TABLE IF EXISTS graphs;
    DROP TABLE IF EXISTS users;
  `);
};
