# ADR 0001: Initial Implementation Stack

- Status: Accepted
- Date: 2026-08-21

## Context

`graphopper-backend` needs an implementation stack for a stateless modular monolith with a versioned REST API, strong PostgreSQL transactions, OpenID Connect token validation, and explicit module boundaries. The repository previously left the programming language, framework, database tooling, API workflow, and test tooling open.

## Decision

- Use Node.js 24 LTS as the production runtime and TypeScript 6 in strict mode.
- Use Fastify 5 as the HTTP adapter.
- Support PostgreSQL 18 as the initial system-of-record version.
- Use `pg` for PostgreSQL connectivity and Kysely for typed query construction behind repository adapters.
- Use `node-pg-migrate` for controlled, forward-ordered database migrations. Application processes do not run migrations at startup.
- Author the public contract first as checked-in OpenAPI 3.1 YAML. Route implementations must be covered by contract tests; generated transport types may be introduced later without becoming the domain model.
- Use `jose` for OIDC discovery, JWKS handling, and bearer-token verification when authentication is implemented.
- Generate UUIDv7 identifiers in the application with the `uuid` package because Node.js does not provide UUIDv7 directly.
- Use Vitest for unit, contract, adapter, and PostgreSQL integration tests.
- Use npm with a committed lockfile, ESLint, and Prettier for reproducible local and CI workflows.

## Rationale

Node.js 24 is an actively supported LTS line. Fastify provides schema-oriented request handling without requiring domain code to depend on the HTTP framework. PostgreSQL remains the transactional boundary chosen by `DESIGN.md`; Kysely provides typed, parameterized queries without making generated persistence models the domain model. A separate migration tool keeps deployment-time schema changes explicit. Contract-first OpenAPI makes the client boundary reviewable before route code exists.

## Consequences

- Production deployments must use a supported Node.js 24 patch release and PostgreSQL 18 minor release.
- The application remains portable across deployment platforms, but those platforms are still an open decision.
- Framework, SQL, migration, OIDC, and storage SDK types must remain in adapter layers.
- Major dependency upgrades require compatibility review and may require a superseding ADR.
