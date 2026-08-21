# Graphopper Monorepo Guidance

## Repository Purpose

This repository is the Graphopper monorepo. It contains the backend and the client applications used to manage and visualize graph data.

Each independently deployable or distributable application must live in a top-level directory whose name starts with `graphopper-`.

## Applications

Current applications:

- `graphopper-backend`: The authenticated backend API and authoritative store for graph data.
- `graphopper-cli`: The command-line client for graphopper-backend.

Anticipated applications may include:

- `graphopper-web`: A browser-based client.
- `graphopper-reactnative`: A React Native mobile client.

Do not create an anticipated application until work on it is explicitly requested.

## Ownership of Responsibilities

### graphopper-backend

graphopper-backend is the source of truth for:

- Authentication and authorization
- User ownership and data isolation
- Graph, node-template, node, and relationship persistence
- Validation of template definitions and node values
- Referential integrity and deletion consequences
- File authorization and storage rules
- Pagination, filtering, search, and traversal behavior exposed by the API
- Stable API errors and resource representations

Security and data-integrity rules must be enforced by graphopper-backend even when a client also performs validation for usability.

### Client Applications

graphopper-cli and future clients are responsible for:

- Presenting backend capabilities to their users
- Collecting and validating input for usability
- Calling documented backend APIs
- Handling authentication credentials safely
- Rendering successful responses and backend errors consistently
- Remaining replaceable without changing backend business rules

A client-side check is not a security boundary. Clients must not assume that hiding an operation or field replaces backend authorization or validation.

### graphopper-cli

graphopper-cli must support both interactive human use and non-interactive automation. It should provide human-readable output by default and machine-readable output when requested.

Destructive commands must request confirmation in interactive use. Automation may bypass confirmation only through an explicit flag such as `--yes`.

Credentials, tokens, passwords, and other secrets must never be printed by default, included in diagnostic output, or committed to the repository.

## Application Boundaries

Each application owns its:

- Source code
- Tests
- Application-specific configuration
- Requirements document
- Build and packaging files
- Developer documentation

Do not import source files directly from another application directory. If code must be shared, introduce an explicitly named shared package with a clear public interface instead of copying code between applications.

Do not introduce a shared package speculatively. Create one only after a concrete reuse requirement exists.

## Requirements

Each application must keep its functional requirements in `<application>/REQUIREMENTS.md`.

Requirements must:

- Use stable identifiers, such as `FR-NODE-001` or `FR-CLI-AUTH-001`.
- Use **shall** for mandatory behavior, **should** for recommended behavior, and **may** for optional behavior.
- Describe externally observable behavior rather than implementation details unless an implementation constraint is intentional.
- State validation, authorization, error, and deletion consequences explicitly.
- Keep unresolved decisions in an assumptions or open-decisions section.

When behavior changes, update the affected requirements document in the same change. A cross-application change must update every affected requirements document.

Backend requirements take precedence for business rules, authorization, persistence, and API behavior. Client requirements must not contradict them.

## API Integration

Clients must consume a documented graphopper-backend API rather than access backend persistence directly.

When an API contract is added:

- Keep request and response representations stable or version them deliberately.
- Preserve machine-readable error codes.
- Document pagination and partial-update semantics.
- Treat identifiers as opaque values.
- Avoid exposing whether an inaccessible resource owned by another user exists.
- Add contract or integration tests for behavior relied upon by clients.

## Repository Conventions

- Use lowercase kebab-case for top-level application and package directories.
- Use the product names `graphopper-backend`, `graphopper-cli`, `graphopper-web`, and `graphopper-reactnative` in technical documentation.
- Keep repository-wide documentation and configuration at the root only when it genuinely applies to multiple applications.
- Run application-specific commands from the relevant application directory unless a future root workspace tool defines repository-wide commands.
- Keep tests within the application or shared package they validate.
- Do not commit generated build outputs, dependency caches, local databases, uploaded files, credentials, or environment-specific secrets.
- Provide example configuration through safe placeholder files when configuration documentation is needed.

## Change Discipline

Before implementing a feature:

1. Identify the owning application.
2. Read that application's `REQUIREMENTS.md`.
3. Check whether the change affects an API contract or another application.
4. Update requirements when externally observable behavior changes.
5. Add or update tests at the appropriate boundary.

Prefer focused changes within one application. Do not restructure unrelated applications as part of a feature change.

## Current Technology Status

No programming language, framework, package manager, database, API protocol, authentication provider, or deployment platform has been selected yet. Do not infer or introduce a technology choice without an explicit architectural decision or implementation request.
