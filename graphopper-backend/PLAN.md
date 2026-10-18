# graphopper-backend Delivery Plan

## Purpose

This plan decomposes `DESIGN.md` into ordered, independently reviewable user stories.

Each story will later pass through its own:

1. Plan
2. Implement
3. Review

Stories should be completed in dependency order unless an iteration explicitly documents why work can proceed in parallel. Each implementation must update affected requirements, API documentation, tests, and architectural decisions in the same change.

Technology selections are deliverables of this plan, but their authoritative outcomes belong in `DESIGN.md` and supporting architecture decision records (ADRs). This document tracks that the decisions must be made; it does not replace the architectural record.

## Story Status

Use these states when iterations begin:

- `Pending`
- `Planning`
- `Implementing`
- `Reviewing`
- `Complete`
- `Blocked`

Implementation snapshot (2026-10-19): stories `US-BE-005` through `US-BE-027` remain `Implementing`. The authenticated API, authorization isolation, resource lifecycles, validation, bounded querying/traversal, managed-file workflow, concurrency, idempotency, auditing, limits, OpenAPI contract, and operational documentation are implemented and tested with an in-process adapter. The PostgreSQL 18 schema and constraints are integration-tested, but the production PostgreSQL repository, private object-storage adapter, cleanup worker, dependency-aware readiness checks, and end-to-end OIDC verification are not yet implemented. Production startup therefore rejects the in-process adapter rather than accepting non-durable writes. `US-BE-028` is `Pending` until those production adapters and release checks are complete.

## Phase 1: Architecture and Application Foundation

### US-BE-001: Resolve Initial Technology Decisions

Status: `Complete`.

**As a backend maintainer, I want the initial technology stack and operational limits recorded so that subsequent implementation uses consistent architectural choices.**

Acceptance criteria:

- The programming language and backend framework are selected.
- PostgreSQL access and migration tooling are selected.
- The OpenAPI authoring workflow is selected.
- The testing framework and project layout are selected.
- The initial OIDC integration approach is documented.
- Initial API, pagination, traversal, upload, and template-migration limits are documented or explicitly deferred.
- Decisions are recorded in `DESIGN.md` and, where useful, supporting ADRs containing context, alternatives, trade-offs, and rationale.
- Resolved items are removed from or marked resolved in the `DESIGN.md` open-decisions section.
- No anticipated client application or speculative shared package is created.

Dependencies: None.

Design references: Sections 4, 22, 27.

### US-BE-002: Establish the Modular-Monolith Application Structure

Status: `Complete`.

**As a backend maintainer, I want a runnable modular-monolith skeleton so that domain capabilities can be implemented behind clear module boundaries.**

Acceptance criteria:

- The application has distinct boundaries for API, authentication, authorization, users, graphs, templates, nodes, relationships, query, traversal, files, audit, and observability.
- Domain and application code do not depend directly on HTTP, SQL, OIDC, or object-storage SDKs.
- Modules communicate through defined application-service or port interfaces.
- Configuration is loaded from runtime configuration without committing secrets.
- The application can start locally with safe development configuration.
- Automated formatting, linting, and unit-test commands are documented.

Dependencies: US-BE-001.

Design references: Sections 4.1, 6, 20.3.

### US-BE-003: Establish PostgreSQL Schema and Migrations

Status: `Complete`.

**As a backend maintainer, I want a versioned relational schema so that graph data and its invariants have an authoritative transactional store.**

Acceptance criteria:

- Migrations create the proposed users, graphs, node templates, template fields, nodes, relationships, file objects, file references, audit events, and outbox tables.
- Ownership, uniqueness, same-graph references, and deletion cascades are enforced where possible with database constraints.
- Identifiers are opaque and timestamps are stored in UTC.
- Required indexes from the design are present.
- A graph can have exactly one logical template.
- Migrations run as a controlled operation rather than automatically from every application instance.
- Integration tests exercise constraints and cascades against a supported PostgreSQL version.

Dependencies: US-BE-001, US-BE-002.

Design references: Sections 7, 8, 18, 19.

### US-BE-004: Establish API Conventions and OpenAPI Contract

Status: `Complete`.

**As a client developer, I want a versioned, consistently documented API contract so that clients can integrate without depending on backend implementation types.**

Acceptance criteria:

- `/v1` is the initial API base path.
- An OpenAPI document is checked into the application.
- JSON naming, unknown-property handling, immutable fields, timestamps, identifiers, and content types are defined.
- Creation, update, deletion, and partial-update conventions are documented.
- A consistent error envelope and stable initial error codes are defined.
- Missing and inaccessible private resources share the non-disclosing `404 RESOURCE_NOT_FOUND` behavior.
- Contract tests verify implemented routes against the OpenAPI document.

Dependencies: US-BE-001, US-BE-002.

Design references: Sections 4.2, 12, 23.

## Phase 2: Operational and Security Baseline

### US-BE-005: Provide Health Checks and Safe Request Observability

**As an operator, I want health information and privacy-safe request diagnostics so that I can operate the service without exposing user data or credentials.**

Acceptance criteria:

- Every request receives or propagates a request identifier.
- Structured logs include route, method, status, duration, and stable error code.
- Logs exclude tokens, signed URLs, request bodies, node values, and uploaded content.
- Liveness and readiness endpoints are provided.
- Readiness reports essential dependency availability without exposing topology or credentials.
- Baseline request, error, latency, and database-pool metrics are emitted.
- Tests verify that sensitive values do not appear in logs or public health responses.

Dependencies: US-BE-002, US-BE-004.

Design references: Sections 20, 21.

### US-BE-006: Authenticate Bearer Tokens and Resolve Local Users

**As a user, I want the backend to recognize my external identity securely so that I can access my Graphopper account without the backend storing my password.**

Acceptance criteria:

- The backend accepts bearer access tokens from a configured OIDC issuer.
- Signature, issuer, audience, time constraints, scopes or claims, and token type are validated as applicable.
- Unknown or invalid signatures are never accepted when signing-key refresh fails.
- The `(issuer, subject)` pair maps uniquely to a local user.
- Configurable just-in-time local-user provisioning is supported.
- `GET /v1/me` returns the authenticated user's basic local account information.
- Missing, invalid, expired, or revoked credentials produce stable authentication errors.
- User passwords and provider credentials are never persisted or logged.

Dependencies: US-BE-003, US-BE-004, US-BE-005.

Design references: Sections 10, 12.1, 20.

Requirements: `FR-AUTH-*`.

### US-BE-007: Enforce Owner-Scoped Authorization and Non-Disclosure

**As a user, I want all graph-owned resources isolated from other users so that possession of an identifier never grants unauthorized access.**

Acceptance criteria:

- Ordinary application services can access graph-owned data only through owner-scoped repository operations.
- Ownership is derived from the authenticated local user and never trusted from request data.
- Cross-user reads and writes fail without revealing whether the resource exists.
- Cross-owner and cross-graph references are rejected.
- Authentication failures return `401`; inaccessible private resources return `404`.
- Automated security tests cover graph, template, node, relationship, and file identifier probing.
- Tests use at least two users and prove data isolation in every implemented resource family.

Dependencies: US-BE-006.

Design references: Sections 5.1, 7.6, 11, 20.

Requirements: `FR-AUTHZ-*`.

## Phase 3: Graph and Template Foundations

### US-BE-008: Manage Graph Metadata

**As an authenticated user, I want to create, list, retrieve, and update my graphs so that I can organize separate graph datasets.**

Acceptance criteria:

- `POST /v1/graphs` creates a graph and its logical template atomically.
- Graph creation supports an empty template or valid initial fields.
- `GET /v1/graphs` returns only graphs owned by the caller.
- `GET /v1/graphs/{graphId}` returns metadata and a template summary.
- `PATCH /v1/graphs/{graphId}` updates only mutable metadata.
- Empty graphs are supported.
- Resource identifiers, versions, and timestamps are returned.
- Graphs cannot be transferred between owners through an ordinary update.

Dependencies: US-BE-003, US-BE-004, US-BE-007.

Design references: Sections 7.2, 8, 12.1.

Requirements: `FR-GRAPH-001`–`004`, `008`–`012`.

### US-BE-009: Retrieve and Add Template Fields

**As a graph owner, I want to inspect my graph's template and add valid fields so that every node can share a uniform schema.**

Acceptance criteria:

- `GET /v1/graphs/{graphId}/template` returns the complete ordered template.
- A field can be added using a stable identifier, unique key, label, type, required flag, description, default, display order, and validation rules.
- Field keys follow the documented naming rules and reject reserved or duplicate keys.
- Default values are validated against the declared type and rules.
- Adding an optional field does not require rewriting existing nodes unless materialization is explicitly requested.
- Adding a required field to an empty graph is supported.
- Template deletion independent of graph deletion is not exposed.
- Template version and timestamps are updated atomically.

Dependencies: US-BE-008.

Design references: Sections 7.3, 9, 13.1–13.3.

Requirements: `FR-TEMPLATE-001`, `002`, `005`–`010`, `019`, `020`.

### US-BE-010: Validate Canonical Node Values

**As a graph owner, I want node values validated consistently against the current template so that invalid graph data cannot be persisted.**

Acceptance criteria:

- Canonical representations are implemented for every supported template type.
- Decimal, date, date-time, URL, Boolean, integer, text, and file-reference rules follow the design.
- Required, optional, missing, explicit-null, and default behavior is implemented.
- Unknown field identifiers are rejected.
- Initial field rules support documented length, pattern, range, enumeration, and file-media constraints.
- Cross-field rules refer to stable field identifiers.
- Validation returns stable error codes and field-level details.
- Unit tests cover canonical parsing, required/default behavior, rule validation, and cross-field validation.

Dependencies: US-BE-009.

Design references: Sections 7.4, 9, 14.

Requirements: `FR-VAL-001`–`005`, `FR-NODE-007`–`012`.

## Phase 4: Nodes and Schema Evolution

### US-BE-011: Manage Nodes

**As a graph owner, I want to create, retrieve, update, list, and delete conforming nodes so that I can maintain the entities in my graph.**

Acceptance criteria:

- Node creation applies defaults and validates the complete candidate node.
- Node retrieval returns values addressable by stable template-field identifiers.
- Partial update changes only supplied values.
- Supplying `null` removes an optional stored value and is rejected for a required field.
- Omitted values remain unchanged.
- Nodes cannot acquire arbitrary fields or move between graphs.
- Node deletion atomically removes connected relationships.
- Failed validation never leaves a partially updated node.
- Node writes cannot commit against an obsolete template version.
- API, integration, and authorization tests cover the complete lifecycle.

Dependencies: US-BE-010.

Design references: Sections 7.4, 12.1, 14, 18.

Requirements: `FR-NODE-*`, `FR-VAL-003`, `007`, `009`.

### US-BE-012: Update Non-Destructive Template-Field Properties

**As a graph owner, I want to rename and reconfigure template fields without losing their identity or existing node values.**

Acceptance criteria:

- Labels, descriptions, display order, validation rules, defaults, and machine keys can be updated where permitted.
- Stable field identifiers never change.
- Key and label changes do not rewrite node values.
- Key uniqueness and reserved-name validation remain enforced.
- Default changes affect new nodes only.
- Required-to-optional changes preserve existing values.
- Updates are atomic and increment the authoritative template version.
- Concurrent writes using stale versions are rejected.

Dependencies: US-BE-011.

Design references: Sections 7.3, 12.3, 13.1, 13.4, 13.6.

Requirements: `FR-TEMPLATE-003`, `005`–`012`, `018`.

### US-BE-013: Apply Graph-Wide Template Migrations Atomically

**As a graph owner, I want schema changes that affect existing nodes to succeed completely or fail completely so that my graph never enters a partially migrated state.**

Acceptance criteria:

- Adding a required field to a populated graph requires a valid materialized default or values for every node.
- Making an optional field required validates or populates every node.
- Data-type changes require an explicit supported conversion policy.
- Incompatible, lossy, or ambiguous conversions fail unless explicitly supported.
- Deleting a field requires explicit destructive confirmation.
- Field deletion removes its key from all affected nodes.
- Each mutation locks the graph, verifies `If-Match`, updates nodes and schema, increments versions, and records an audit event in one transaction.
- Mutations exceeding configured synchronous limits fail with `TEMPLATE_MIGRATION_TOO_LARGE` and make no changes.
- Integration tests cover rollback and concurrent node/template writes.

Dependencies: US-BE-011, US-BE-012.

Design references: Section 13.

Requirements: `FR-TEMPLATE-013`–`017`, `FR-VAL-008`.

## Phase 5: Relationships and Graph Retrieval

### US-BE-014: Manage Directed Relationships

**As a graph owner, I want to manage directed relationships between my nodes so that I can describe how entities are connected.**

Acceptance criteria:

- Relationships can be created, listed, retrieved, updated, and deleted.
- Source, target, and relationship belong to the same graph.
- Ownership and endpoint validation occur in one owner-scoped transaction.
- Self-references and multiple edges are permitted.
- Type and label limits are validated.
- Deleting a node removes its incoming and outgoing relationships.
- Composite database constraints defend against cross-graph endpoints.
- Relationship list responses use deterministic ordering.

Dependencies: US-BE-011.

Design references: Sections 7.5, 8.1, 12.1, 15.1.

Requirements: `FR-REL-*`, `FR-VAL-006`.

### US-BE-015: Provide Reusable Cursor Pagination

**As a client developer, I want bounded and deterministic list responses so that clients can process large resource collections safely.**

Acceptance criteria:

- Graph, node, and relationship lists use opaque cursor pagination.
- Responses contain `items`, `nextCursor`, and `hasMore`.
- Cursors bind the applied sort, last value, tie-breaker, and query signature.
- Modified or incompatible cursors are rejected.
- Defaults and hard maximum page sizes are configurable.
- Every supported ordering includes a deterministic identifier tie-breaker.
- Cursor parsing and validation have focused unit and contract tests.

Dependencies: US-BE-008, US-BE-011, US-BE-014.

Design references: Section 12.5.

Requirements: `FR-QUERY-001`, `002`.

### US-BE-016: Filter, Search, and Sort Nodes and Relationships

**As a client user, I want controlled filtering, search, and sorting so that I can find relevant graph data without downloading an entire graph.**

Acceptance criteria:

- Node filters reference stable field identifiers and type-compatible operators.
- Supported operations include equality, inequality, presence, bounded membership, numeric/date comparison, and safely limited text matching.
- Text search operates only on explicitly requested supported fields within one owned graph.
- Node sorting uses an allowlist of compatible system or template fields.
- Relationships can be filtered by source, target, and type.
- Query construction is parameterized and does not accept raw SQL, JSON paths, regexes, or sort expressions.
- Query limits produce stable errors.
- Integration tests cover JSONB filtering, sorting, isolation, and representative query plans.

Dependencies: US-BE-010, US-BE-014, US-BE-015.

Design references: Section 16.

Requirements: `FR-QUERY-003`–`006`.

### US-BE-017: Traverse a Bounded Graph

**As a client user, I want to traverse connections from a starting node so that I can explore a relevant neighborhood safely.**

Acceptance criteria:

- Traversal supports outgoing, incoming, and bidirectional directions.
- Requests may filter relationship types and request a maximum depth.
- Cycles do not cause infinite traversal.
- Hard limits apply to depth, nodes, relationships, execution time, and response size.
- Responses include reached nodes, traversed relationships, optional depth information, and a truncation indicator.
- Traversal never crosses graph ownership boundaries.
- PostgreSQL integration tests cover cycles, direction, filters, truncation, and oversized requests.

Dependencies: US-BE-014.

Design references: Section 15.2.

Requirements: `FR-QUERY-007`.

### US-BE-018: Retrieve Bounded Graph Data for Visualization

**As a client developer, I want a bounded graph-data representation so that I can render a graph without issuing an unbounded number of requests.**

Acceptance criteria:

- `GET /v1/graphs/{graphId}/data` returns the template and bounded node and relationship collections.
- Small graphs may be returned in one response.
- Larger results include pagination cursors or a truncation indicator.
- The endpoint never loads an unbounded graph into application memory.
- Ownership isolation applies to the entire response.
- Response-size and result-count limits are configurable and tested.

Dependencies: US-BE-015, US-BE-016.

Design references: Sections 12.6, 26.

Requirements: `FR-GRAPH-007`, `FR-QUERY-001`, `002`.

## Phase 6: Managed Files

### US-BE-019: Authorize and Finalize Private Uploads

**As a graph owner, I want to upload a private file safely so that it can later be used by an image or file-reference field.**

Acceptance criteria:

- Upload authorization verifies graph ownership and requested media constraints.
- The backend creates a pending file with a generated private object key.
- The client receives a narrow, short-lived signed upload URL.
- Upload completion verifies object existence, size, media type, and configured checksum requirements.
- A file cannot be referenced until it is ready.
- Failed or invalid uploads become rejected or remain eligible for expiry cleanup.
- Storage credentials, raw object keys, and permanent public URLs are never exposed.
- File lifecycle tests cover metadata verification and unauthorized operations.

Dependencies: US-BE-007, US-BE-010.

Design references: Sections 4.6, 8.1, 17.1, 20.

Requirements: `FR-FILE-001`–`004`.

### US-BE-020: Reference, Download, Replace, and Remove Files

**As a graph owner, I want to use managed files or allowed external URLs in node fields so that nodes can contain authorized photos and documents.**

Acceptance criteria:

- A ready managed file can be assigned only to a compatible field, node, graph, and owner.
- `file_references` is maintained transactionally with node values.
- External URLs are accepted only when allowed by the field and URL policy.
- Authorized downloads return short-lived signed URLs.
- Files belonging to another user cannot be referenced or downloaded.
- Optional file values can be replaced or removed.
- Direct deletion of a referenced managed file is rejected.
- Tests cover cross-user, cross-graph, not-ready, replacement, removal, and download cases.

Dependencies: US-BE-011, US-BE-019.

Design references: Sections 8.1, 9, 17.2.

Requirements: `FR-FILE-002`, `003`, `005`, `006`.

### US-BE-021: Clean Up Orphaned Managed Files

**As an operator, I want orphaned file objects cleaned up reliably so that database deletion and object-storage deletion remain eventually consistent.**

Acceptance criteria:

- Node, field, graph, or file-reference deletion detects newly orphaned files transactionally.
- Orphaned files are marked deletion-pending and paired with an outbox event.
- A worker processes deletion events idempotently.
- Failed deletion is retried with bounded backoff.
- Expired pending uploads are cleaned up.
- External URLs are never deleted.
- Metrics expose backlog and repeated failures.
- Tests cover orphan detection, retries, duplicate processing, and eventual metadata cleanup.

Dependencies: US-BE-013, US-BE-020.

Design references: Sections 8.1, 17.3, 18, 19.

Requirements: `FR-FILE-007`.

## Phase 7: Consistency, Auditing, and Resilience

### US-BE-022: Enforce Optimistic Concurrency

**As a client user, I want conflicting changes detected so that one update does not silently overwrite another.**

Acceptance criteria:

- Mutable resources expose version-derived ETags.
- Relevant update and destructive operations accept or require `If-Match` as documented.
- Stale versions return `412 RESOURCE_VERSION_MISMATCH`.
- Template-changing operations require the graph/template version.
- Lock acquisition follows graph-before-child ordering.
- Concurrency tests cover graph updates, node writes, and template mutations.

Dependencies: US-BE-008, US-BE-011, US-BE-013, US-BE-014.

Design references: Sections 12.3, 18.2.

### US-BE-023: Make Eligible Creation Requests Idempotent

**As an automation client, I want safe request retries so that transient failures do not create unintended duplicate resources.**

Acceptance criteria:

- Eligible creation endpoints accept `Idempotency-Key`.
- Keys are scoped to user, endpoint, and normalized request body.
- An exact retry returns the original response.
- Reusing a key with a different request is rejected.
- Idempotency records have a configurable bounded retention period.
- Concurrent and repeated-request behavior is covered by integration tests.

Dependencies: US-BE-008, US-BE-011, US-BE-014.

Design references: Section 18.3.

### US-BE-024: Record Privacy-Safe Mutation Audit Events

**As an operator, I want security and mutation audit records so that important changes can be investigated without retaining private graph contents.**

Acceptance criteria:

- Mutations record actor, action, resource type, resource identifier, graph identifier where applicable, outcome, request identifier, and timestamp.
- Audit records are committed in the same database transaction as mutations.
- Destructive events do not retain deleted node values or file contents.
- Tokens, signed URLs, and credentials are never recorded.
- Audit retention and access policy are documented or recorded as an open deployment decision.
- Tests prove transaction rollback does not leave a successful audit event.

Dependencies: US-BE-006, US-BE-008.

Design references: Sections 4.7, 8.1, 19, 21.

Requirements: `FR-AUDIT-*`.

### US-BE-025: Complete Hard-Deletion Behavior

**As a graph owner, I want deletions to have consistent and documented consequences so that removed resources cannot remain active or affect another user.**

Acceptance criteria:

- Graph deletion removes its template, fields, nodes, relationships, and file references atomically.
- Field deletion removes corresponding node values.
- Node deletion removes connected relationships.
- A file can be deleted directly only when unreferenced.
- Object deletion is scheduled through the outbox.
- Repeated deletion returns the documented idempotent result.
- Parent ownership validation prevents deletion requests from revealing private resource existence.
- Deletion consequences are covered by database, API, audit, and file-cleanup tests.

Dependencies: US-BE-013, US-BE-014, US-BE-021, US-BE-024.

Design references: Sections 4.7, 12.2, 19.

Requirements: `FR-GRAPH-005`, `006`, `FR-NODE-005`, `006`, `FR-TEMPLATE-015`, deletion policy.

## Phase 8: Hardening and Release Readiness

### US-BE-026: Apply API Security Limits and Rate Controls

**As an operator, I want unsafe and excessively expensive requests constrained so that the service remains secure and available.**

Acceptance criteria:

- Request shape, content type, body size, string length, and collection counts are bounded.
- Filter fields, operators, sorts, URL schemes, and media types use allowlists.
- SQL is parameterized.
- Authentication failures, expensive queries, traversal, and upload authorization can be rate-limited.
- Public errors exclude stack traces, SQL details, storage keys, and internal exceptions.
- Ambiguous duplicate JSON properties are rejected where supported.
- Security tests cover unsafe filters, oversized operations, token failures, and log leakage.

Dependencies: US-BE-005, US-BE-016, US-BE-017, US-BE-019.

Design references: Section 20.

### US-BE-027: Validate Performance Limits and Query Behavior

**As an operator, I want measured operating limits so that expensive graph operations fail predictably before harming service stability.**

Acceptance criteria:

- Representative graph sizes are tested for list, JSONB filter, traversal, graph-data, and template-migration operations.
- Query plans and latency are reviewed for supported query patterns.
- Page, traversal, response, upload, and synchronous migration limits are validated and documented.
- Metrics expose template-migration size and duration, traversal truncation and timeout, and file cleanup backlog.
- Additional indexes are introduced only when supported by workload evidence.
- Any unmet target is recorded with a mitigation or evolution trigger.

Dependencies: US-BE-013, US-BE-016, US-BE-017, US-BE-018, US-BE-021.

Design references: Sections 13.8, 16.4, 21.2, 26.

### US-BE-028: Complete End-to-End and Release Verification

**As a client developer and operator, I want the complete backend workflow verified so that the initial API can be released with confidence.**

Acceptance criteria:

- End-to-end tests authenticate through a test identity provider.
- Tests create a graph and template, create nodes, create and traverse relationships, upload and reference a file, mutate the template, and delete resources.
- A second user verifies ownership isolation throughout the flow.
- OpenAPI contract, unit, PostgreSQL integration, security, concurrency, file, and end-to-end suites pass.
- API compatibility and stable error codes are reviewed.
- Backup, restore, migration rollback or forward-fix, secret management, and deployment responsibilities are documented.
- Remaining deployment-specific decisions are explicitly recorded.
- `REQUIREMENTS.md`, `DESIGN.md`, OpenAPI, and operational documentation agree with implemented behavior.

Dependencies: All preceding stories.

Design references: Sections 22–28.

## Dependency Summary

The primary delivery path is:

`Technology decisions -> application foundation -> persistence/API -> authentication -> authorization -> graphs -> templates -> validation -> nodes -> relationships/query -> files -> hardening -> release verification`

Stories within a phase may be planned in parallel only when their listed dependencies are satisfied and they do not modify the same contract or aggregate invariant.

## Iteration Rules

For each story's later plan-implement-review iteration:

- Confirm the story still agrees with `REQUIREMENTS.md` and `DESIGN.md`.
- Resolve any story-specific open decisions before implementation.
- Define the exact API and persistence changes.
- Implement the smallest complete vertical slice.
- Add unit, integration, contract, and security tests appropriate to the boundary.
- Review authorization, atomicity, privacy, concurrency, deletion, and error behavior.
- Update documentation and traceability in the same iteration.
- Mark the story complete only when its acceptance criteria are demonstrably satisfied.
