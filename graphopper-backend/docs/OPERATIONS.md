# graphopper-backend Operations

## Deployment responsibilities

- The current executable is not production-deployable until a durable PostgreSQL `BackendStore` and private object-storage adapter are wired into startup. Production mode deliberately refuses the in-process store so it cannot accept non-durable writes accidentally.
- Run database migrations as a controlled release step before starting the compatible application version. API instances never migrate automatically.
- Supply `DATABASE_URL`, `CURSOR_SECRET`, `OIDC_ISSUER`, `OIDC_AUDIENCE`, and `OIDC_JWKS_URL` from the deployment secret/configuration system. Rotate database and cursor credentials through that system; never commit them.
- Terminate public TLS at the trusted edge and use encrypted private connections to PostgreSQL and object storage.
- Restrict `/metrics` to the operational network at the gateway. Health responses intentionally contain no topology or credential details.
- Configure identity-provider signing-key caching and outbound access to the configured JWKS endpoint.

## Backup and recovery

- Use PostgreSQL physical backups or managed-service snapshots plus point-in-time WAL recovery. Backups must include migration metadata.
- Back up managed object storage with versioning or provider recovery controls consistent with PostgreSQL recovery objectives.
- Test restores in an isolated environment. Restore PostgreSQL and object storage to a mutually consistent point, apply forward migrations, then run API smoke tests before serving traffic.
- The initial migration policy is forward-fix. A down migration is suitable only before a release has accepted production writes.

## Workers and retention

- Process file-deletion outbox events idempotently and alert on backlog age or repeated failure.
- Remove expired pending uploads and expired idempotency records on a scheduled worker run.
- Audit-event retention is deployment-specific. Retain only operational metadata; audit rows never contain node values, tokens, signed URLs, or file contents.

## Release verification

Run `npm run check` and the PostgreSQL suite with `npm run test:integration`. Verify liveness, readiness, authentication, ownership isolation, an end-to-end graph workflow, upload/download, migration compatibility, and restore procedures before promotion.
