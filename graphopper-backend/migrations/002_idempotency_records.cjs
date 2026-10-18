exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE idempotency_records (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint text NOT NULL,
      idempotency_key text NOT NULL,
      request_digest text NOT NULL,
      response_status integer NOT NULL,
      response_body jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at timestamptz NOT NULL,
      PRIMARY KEY (user_id, endpoint, idempotency_key),
      CONSTRAINT idempotency_expiry_ordered CHECK (expires_at > created_at)
    );

    CREATE INDEX idempotency_records_expiry_idx
      ON idempotency_records(expires_at);
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS idempotency_records;');
};
