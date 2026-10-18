# API Conventions

The checked-in `openapi/openapi.yaml` file is the machine-readable integration boundary for clients. Implemented routes must be added to it and covered by contract tests in the same change.

## Version and Media Type

- The initial base path is `/v1`.
- API requests and responses use `application/json`, except for signed object-storage transfers.
- JSON properties use lower camel case.
- Unknown request properties are rejected by default.
- Clients must tolerate unknown additive response properties.

## Resource Representations

- Identifiers are opaque strings and currently use UUID representations.
- Persisted timestamps use UTC and API timestamps use RFC 3339 with an explicit offset.
- System-managed identifiers, ownership, versions, and timestamps are read-only.
- Mutable resource representations include `id`, `version`, `createdAt`, and `updatedAt` where applicable.
- Mutable resources expose an ETag derived from `version` when their routes are implemented.

## Mutations

- Successful creation returns `201` and the created resource.
- `PATCH` applies merge semantics only to supplied mutable properties.
- Clearing an optional node value sends its field identifier with `null`; omission means unchanged.
- Successful deletion returns `204` with no response body.
- Repeating deletion returns `204` when the caller still identifies an owned valid parent graph; an absent or inaccessible parent returns the normal non-disclosing `404`.
- Operations protected by optimistic concurrency use `If-Match`; stale versions return `412` with `RESOURCE_VERSION_MISMATCH`.

## Errors and Privacy

Every public error uses `ErrorEnvelope` from the OpenAPI components and includes a stable code, human-readable message, optional safe details, and request identifier. Internal exceptions, SQL details, stack traces, credentials, object keys, signed URLs, and private node values are never returned.

An absent private resource and a resource belonging to another user both return `404 RESOURCE_NOT_FOUND`. This convention prevents identifier probing from revealing private resource existence.
