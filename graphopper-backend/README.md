# graphopper-backend

Authenticated backend API and authoritative graph data store for Graphopper.

## Prerequisites

- Node.js 24 LTS
- npm
- PostgreSQL 18 for migrations and integration tests

## Local Development

Install dependencies and start the application:

```sh
npm install
cp .env.example .env
npm run dev
```

Node.js reads runtime values from the process environment. To load `.env` explicitly, start with `node --env-file=.env` or export the values before running npm commands.

## Quality Commands

```sh
npm run format
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run check` runs the non-database verification suite. PostgreSQL integration tests are intentionally separate:

```sh
TEST_DATABASE_URL=postgresql://graphopper:graphopper@127.0.0.1:5432/graphopper_test npm run test:integration
```

## Database Migrations

Migrations are a controlled deployment step and are never run automatically by an API instance:

```sh
DATABASE_URL=postgresql://graphopper:graphopper@127.0.0.1:5432/graphopper npm run db:migrate
```

## Architecture

The application is a modular monolith. Domain and application behavior live behind module and port boundaries; Fastify, PostgreSQL, OIDC, and object-storage code are adapters. See `DESIGN.md` and `docs/decisions` for authoritative decisions.

## API and Operations

The versioned API is documented in `openapi/openapi.yaml`. Protected routes require an OIDC bearer access token. Operational endpoints are:

- `GET /health/live`
- `GET /health/ready`
- `GET /metrics`

Resource APIs cover the current user, graphs, templates, nodes, relationships, bounded traversal and graph data, and private managed-file authorization/finalization/download.

Production startup requires PostgreSQL, a non-default cursor signing secret, and complete OIDC issuer, audience, and JWKS configuration. See `docs/OPERATIONS.md` for deployment, backup, recovery, and secret-management responsibilities.

The default in-process store is intended for development and automated API tests only. Production mode fails closed until an explicitly configured durable store is supplied; the PostgreSQL repository and private object-storage adapter remain implementation work tracked in `PLAN.md`.
