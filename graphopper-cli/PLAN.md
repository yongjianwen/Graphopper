# graphopper-cli Delivery Plan

## Purpose

This plan decomposes `DESIGN.md` into ordered, independently reviewable user stories for delivering `graphopper-cli`.

Each story will later pass through its own:

1. Plan
2. Implement
3. Review

Stories should be completed in dependency order unless an iteration documents why parallel work is safe. Each implementation must update affected requirements, CLI documentation, API contract tests, and architectural decisions in the same change.

Technology selections are deliverables of this plan, but their authoritative outcomes belong in `DESIGN.md` and supporting architecture decision records (ADRs).

## Story Status

Use these states when iterations begin:

- `Pending`
- `Planning`
- `Implementing`
- `Reviewing`
- `Complete`
- `Blocked`

Implementation snapshot (2026-10-18): stories `US-CLI-001` through `US-CLI-031` are in `Reviewing`. Their command, adapter, documentation, packaging, and conforming-mock test slices are implemented. `US-CLI-032` remains `Blocked` at live end-to-end verification because graphopper-backend currently exposes its Phase 1 health/operational foundation but not the graph, template, node, relationship, traversal, file, or OIDC-facing API operations required by that story. The CLI uses a conforming mock at those boundaries until those backend stories land.

## Phase 1: Architecture and CLI Foundation

### US-CLI-001: Resolve Initial Technology and Distribution Decisions

**As a CLI maintainer, I want the implementation stack and supported platforms selected so that subsequent work targets a consistent runtime and distribution model.**

Acceptance criteria:

- The implementation language and CLI framework are selected.
- Supported operating systems and CPU architectures are selected.
- The binary or runtime-dependent distribution model is selected.
- Configuration format and per-platform locations are selected.
- Credential-store libraries and fallback behavior are selected.
- The interactive OIDC flow is selected.
- Environment-variable names and numeric exit codes are defined.
- Initial pagination, traversal, output, and timeout limits are documented.
- Decisions are recorded in `DESIGN.md` and, where useful, supporting ADRs.
- Resolved items are removed from or marked resolved in the `DESIGN.md` open-decisions section.
- No source code is imported directly from `graphopper-backend`.

Dependencies: None.

Design references: Sections 5, 6, 26, 31.

### US-CLI-002: Establish the Command-Oriented Application Structure

**As a CLI maintainer, I want a runnable layered application skeleton so that commands remain separate from transport, credentials, input, and presentation concerns.**

Acceptance criteria:

- The installed root command is `graphopper`, unless a documented packaging constraint requires an alternative.
- Boundaries exist for commands, application operations, backend access, authentication, configuration, credential storage, input, confirmation, file transfer, and presentation.
- Commands invoke application operations instead of making HTTP calls directly.
- Application operations depend on replaceable ports.
- Transport models are translated at the backend adapter boundary when necessary.
- The application builds and starts on every initially supported platform.
- Formatting, linting, unit-test, and build commands are documented.

Dependencies: US-CLI-001.

Design references: Sections 5–7.

Requirements: `FR-CLI-CORE-001`, `002`, `005`.

### US-CLI-003: Provide Command Discovery, Help, and Version Information

**As a user, I want consistent command discovery and contextual help so that I can learn the CLI without external documentation or backend access.**

Acceptance criteria:

- The proposed resource-oriented command hierarchy is implemented.
- The root command and every subcommand provide contextual help.
- Non-trivial commands include representative examples.
- Help identifies required arguments, options, authentication needs, prompts, and destructive effects.
- Help succeeds without configuration, credentials, or backend availability.
- Unknown commands and options produce actionable usage errors.
- `graphopper version` works without network access.
- Version output follows the documented human and machine-readable conventions.
- Shell parsing preserves Unicode arguments and opaque identifiers.

Dependencies: US-CLI-002.

Design references: Sections 7, 25, 26.

Requirements: `FR-CLI-CORE-001`–`005`.

### US-CLI-004: Establish Process Lifecycle and Stream Discipline

**As an interactive or automation user, I want predictable process behavior so that commands work safely in terminals, scripts, pipes, and CI systems.**

Acceptance criteria:

- Commands detect whether required streams are connected to terminals.
- Redirected or piped execution does not prompt unexpectedly.
- `--non-interactive` prohibits prompts and browser-launch assumptions.
- `--non-interactive` never implies destructive consent.
- Successful result data is written to standard output.
- Prompts, warnings, progress, diagnostics, and errors are written to standard error.
- Operating-system cancellation signals propagate to HTTP requests and file transfers.
- A cancelled command never reports success.
- Incompatible global options are rejected consistently.
- Tests cover interactive terminals, redirected streams, pipes, and cancellation.

Dependencies: US-CLI-002.

Design references: Sections 7.2, 8, 18.3, 19.1.

Requirements: `FR-CLI-CORE-005`–`008`.

## Phase 2: Configuration, Input, and Presentation

### US-CLI-005: Manage Configuration and Named Profiles

**As a user, I want configuration profiles and deterministic precedence so that I can work safely with multiple backend environments.**

Acceptance criteria:

- Users can configure the backend URL, API expectations, output format, timeout, and optional default graph.
- Named profiles can be created, selected, listed, and inspected.
- Profile selection follows the documented precedence.
- Configuration values follow command-line, environment, profile, and default precedence.
- An explicitly invalid higher-precedence value produces an error rather than falling back.
- Profile names cannot be interpreted as arbitrary filesystem paths.
- Configuration is stored in the conventional per-user platform location.
- Configuration writes are validated and atomic.
- User-only permissions are applied where supported.
- Credentials and signed URLs are never stored in ordinary configuration.

Dependencies: US-CLI-001, US-CLI-004.

Design references: Section 9.

Requirements: `FR-CLI-CONFIG-001`–`006`.

### US-CLI-006: Inspect and Validate Effective Configuration

**As a user, I want to inspect and test my active configuration so that I can diagnose connection problems without exposing secrets.**

Acceptance criteria:

- `graphopper config get` displays effective non-secret configuration.
- The active profile is clearly identified.
- The source of each effective value is shown where practical.
- Sensitive values are redacted.
- `graphopper config check` separately reports syntax, URL safety, connectivity, API compatibility, and authentication status.
- Backend URL overrides affect only the current command.
- HTTPS is required except for explicitly enabled loopback development servers.
- Failures return stable, actionable error categories.

Dependencies: US-CLI-005, US-CLI-009.

Design references: Sections 9.5, 11.5, 24.1.

Requirements: `FR-CLI-CONFIG-002`, `005`–`007`, `FR-CLI-COMPAT-*`.

### US-CLI-007: Support Structured and Interactive Input

**As a user, I want consistent input mechanisms so that I can use the same commands interactively and in automation.**

Acceptance criteria:

- Commands can accept documented combinations of positional arguments, options, prompts, structured files, and standard input.
- Ambiguous combinations are rejected.
- Structured input uses UTF-8 JSON and rejects unknown properties.
- The documented `-` marker reads structured content from standard input.
- A command reading standard input does not also prompt from that stream.
- Explicit options may override structured non-secret values only where documented.
- Duplicate assignments to the same resolved field are rejected.
- Local file paths are checked for existence, type, and readability.
- Local paths are resolved without changing the process working directory.
- Resource identifiers remain opaque strings without reformatting.

Dependencies: US-CLI-004.

Design references: Section 18.

Requirements: `FR-CLI-IO-004`–`007`.

### US-CLI-008: Provide Human-Readable Output

**As an interactive user, I want concise terminal output so that I can understand command results without processing JSON.**

Acceptance criteria:

- Collections default to an appropriate table view.
- Individual resources default to a labeled detail view.
- Output adapts safely to terminal width.
- Unicode and color are supported where terminal capabilities allow.
- ANSI formatting is disabled when output is redirected unless explicitly forced.
- Empty results, truncation, and partial results are clearly identified.
- Human output is documented as unsuitable for stable script parsing.
- Golden tests cover narrow terminals, Unicode, redirected output, disabled color, empty results, and truncation.

Dependencies: US-CLI-003, US-CLI-004.

Design references: Section 19.2.

Requirements: `FR-CLI-IO-001`, `006`.

### US-CLI-009: Provide Stable Machine-Readable Output and Exit Categories

**As an automation user, I want stable JSON, standard streams, and exit categories so that scripts can consume results reliably.**

Acceptance criteria:

- `--output json` emits one complete UTF-8 JSON value on standard output.
- Canonical backend values and opaque identifiers are preserved.
- Pagination and truncation metadata are preserved.
- Progress, warnings, prompts, and diagnostics never corrupt JSON output.
- Machine-readable errors use a stable CLI-owned envelope.
- Backend error codes, request identifiers, and validation details are preserved.
- Exact numeric exit codes are documented for success, usage, authentication, access/not-found, validation, conflict, network, partial, cancellation, and internal failure.
- Identifier-only output is available for suitable creation commands.
- Golden tests protect machine-output compatibility.

Dependencies: US-CLI-004, US-CLI-008.

Design references: Sections 19.3–19.5, 22.

Requirements: `FR-CLI-IO-002`, `003`, `007`, `FR-CLI-ERR-*`.

## Phase 3: Backend Integration and Authentication

### US-CLI-010: Implement the Versioned Backend API Client

**As a CLI application operation, I want a safe backend client so that commands can consume the documented API without depending on transport details.**

Acceptance criteria:

- The client targets the configured `/v1` backend API.
- The checked-in backend OpenAPI document is used as the source contract when available.
- Generated transport code, if used, is wrapped by an application-facing interface.
- HTTPS is enforced except for approved loopback development.
- Credentials are sent only to the normalized trusted origin.
- Redirects are validated and never forward credentials to an untrusted origin.
- Accepted content types, client version, request identifier, and bounded timeouts are sent as documented.
- Cancellation propagates to requests.
- Additive response fields are tolerated.
- Invalid or missing required response fields produce protocol errors.

Dependencies: US-CLI-002, US-CLI-005, US-CLI-009.

Design references: Section 11.

### US-CLI-011: Map Errors, Retries, Concurrency, and Idempotency

**As a user, I want backend failures and uncertain mutations handled predictably so that the CLI never conceals conflicts or incorrectly reports success.**

Acceptance criteria:

- Backend stable error codes and request identifiers are preserved.
- Local input, authentication, access/not-found, validation, conflict, network, partial, cancellation, and internal failures remain distinguishable.
- Safe reads may retry transient failures using bounded exponential backoff with jitter.
- Rate-limit retry hints are honored only within safe configured bounds.
- Version conflicts are not automatically retried.
- Unprotected mutations are not retried after an indeterminate response.
- Supported mutations retain one idempotency key across automatic retries of a logical operation.
- Interactive read-modify-write operations send `If-Match`.
- `RESOURCE_VERSION_MISMATCH` instructs the user to retrieve the current resource and retry.
- A timeout after mutation submission is described as indeterminate rather than failed or successful.

Dependencies: US-CLI-009, US-CLI-010.

Design references: Sections 11.3–11.4, 20.4, 22, 23.

Requirements: `FR-CLI-ERR-*`.

### US-CLI-012: Store Credentials Safely

**As a user, I want credentials isolated in the operating-system credential store so that they are not exposed in ordinary configuration.**

Acceptance criteria:

- Persisted credentials use an OS credential-store adapter.
- Credential lookup keys include the active profile and normalized backend or issuer identity.
- Credential writes and updates are atomic where the platform supports them.
- Concurrent processes do not corrupt stored credential state.
- Stored credentials are never displayed by configuration commands.
- Plaintext credential-file storage is disabled by default.
- When no credential store is available, the CLI explains the limitation and supports in-memory or externally supplied credentials.
- Adapter tests cover lookup, replacement, deletion, platform errors, and unavailable-store behavior.

Dependencies: US-CLI-001, US-CLI-005.

Design references: Sections 10.3–10.4, 24.2.

Requirements: `FR-CLI-AUTH-003`, `005`, `009`.

### US-CLI-013: Authenticate Interactive and Automation Users

**As a user, I want secure interactive and non-interactive authentication so that I can use Graphopper without supplying an identity-provider password to the CLI.**

Acceptance criteria:

- Interactive login uses the selected device authorization or Authorization Code with PKCE flow.
- The CLI never requests the identity-provider password.
- Browser-launch failure falls back to displaying a safe manual URL where possible.
- Interactive secret input is not echoed.
- Automation can provide a bearer token through a documented environment variable or protected standard-input mechanism.
- Command-line token arguments are not offered as the preferred mechanism.
- An externally supplied token applies only to the current process.
- An external token never silently overwrites a stored credential.
- Refresh is attempted at most once when a stored refresh credential is available.
- Network refresh failure does not destroy a potentially valid credential.
- Definitively invalid refresh credentials are handled according to the documented policy.

Dependencies: US-CLI-010, US-CLI-012.

Design references: Sections 10.1–10.4, 24.2.

Requirements: `FR-CLI-AUTH-001`–`005`, `008`, `009`.

### US-CLI-014: Report Authentication Status and Sign Out

**As a user, I want to inspect my current identity and sign out so that I can control which account and environment the CLI uses.**

Acceptance criteria:

- `graphopper auth status` reports the active profile and current backend user.
- Status uses `/v1/me` when possible.
- Tokens and unnecessary raw claims are not displayed.
- `graphopper auth logout` removes the locally stored credential.
- Provider revocation is attempted when supported and requested.
- Local removal and remote revocation are reported separately when their outcomes differ.
- Authentication failures are actionable and return the documented non-zero exit code.
- Neither status nor logout logs rejected credentials.

Dependencies: US-CLI-013.

Design references: Sections 10.5–10.6.

Requirements: `FR-CLI-AUTH-006`–`009`.

## Phase 4: Safety and Graph Commands

### US-CLI-015: Enforce Destructive Confirmation Policy

**As a user, I want consistent safeguards around destructive operations so that data cannot be deleted accidentally in a terminal or script.**

Acceptance criteria:

- Graph, template-field, node, and relationship deletion require confirmation interactively.
- Prompts identify the target using its name or label and opaque identifier when available.
- Prompts summarize known cascading effects and irreversibility.
- Empty or negative responses reject the operation.
- `--yes` is the only common confirmation bypass.
- Non-interactive execution without `--yes` fails before sending the mutation.
- `--non-interactive` never acts as consent.
- Success is reported only after backend confirmation.
- Tests cover every destructive command in interactive and non-interactive modes.

Dependencies: US-CLI-004, US-CLI-009, US-CLI-011.

Design references: Section 20.

Requirements: `FR-CLI-SAFE-*`.

### US-CLI-016: Create, List, Show, and Update Graphs

**As a graph owner, I want to manage graph metadata from the command line so that I can create and organize graph datasets.**

Acceptance criteria:

- `graph create` accepts a name, optional description, and optional structured initial template.
- Interactive mode may prompt for missing required values.
- Non-interactive mode requires all required values explicitly.
- Successful creation displays the graph identifier and name.
- `graph list` supports bounded pagination and sorting.
- `graph show` retrieves metadata and a template summary without implicitly loading all nodes and relationships.
- `graph update` patches only explicitly supplied metadata.
- Interactive updates preserve and submit the known resource version.
- Human, JSON, and identifier-only output are supported where applicable.

Dependencies: US-CLI-011, US-CLI-013.

Design references: Sections 12.1–12.3, 12.5.

Requirements: `FR-CLI-GRAPH-001`–`005`.

### US-CLI-017: Retrieve Graph Data and Delete Graphs Safely

**As a graph owner, I want bounded graph retrieval and safe graph deletion so that I can inspect or remove a graph without accidental unbounded output or data loss.**

Acceptance criteria:

- `graph data` calls the backend's bounded graph-data endpoint.
- Human output clearly identifies truncation.
- JSON output preserves cursors and truncation metadata.
- The CLI does not implicitly request or render an unbounded graph.
- `graph delete` warns about template, node, relationship, value, and managed-file consequences.
- Confirmation identifies the graph by name and identifier where retrieval succeeds.
- Non-interactive deletion requires `--yes`.
- Backend completion remains authoritative for reporting success.

Dependencies: US-CLI-015, US-CLI-016.

Design references: Sections 12.4, 12.6, 20.

Requirements: `FR-CLI-GRAPH-006`–`008`.

## Phase 5: Templates and Nodes

### US-CLI-018: Inspect Templates and Add Fields

**As a graph owner, I want to inspect a template and add fields so that I can define the values available on every node.**

Acceptance criteria:

- `template show` displays fields in display order.
- Field output includes stable identifier, key, label, type, required status, default, and validation summary.
- `template field add` accepts all backend-supported field properties.
- Required fields on populated graphs require an appropriate default or complete backend-supported value mapping.
- Structured validation rules can be supplied through documented input.
- Field-specific backend validation errors are preserved and displayed.
- The backend remains authoritative for schema feasibility and validation.

Dependencies: US-CLI-007, US-CLI-011, US-CLI-016.

Design references: Sections 13.1–13.2.

Requirements: `FR-CLI-TEMPLATE-001`, `002`, `007`, `008`.

### US-CLI-019: Update and Delete Template Fields Safely

**As a graph owner, I want impactful template changes explained and version-protected so that I understand their consequences before changing every affected node.**

Acceptance criteria:

- Field update supports all documented editable properties.
- Label/key edits are distinguished from changes affecting stored values.
- Type and required-status changes explain known impact before submission.
- The current graph/template version is sent through `If-Match`.
- Version conflicts are not retried automatically.
- Field deletion states that the value will be removed from every node.
- The confirmation identifies the field and graph and includes an affected-node count when provided.
- CLI `--yes` and backend destructive-confirmation properties are both handled according to their distinct roles.
- Incompatible existing values are displayed as field-specific backend errors.

Dependencies: US-CLI-015, US-CLI-018.

Design references: Sections 13.3–13.4.

Requirements: `FR-CLI-TEMPLATE-003`–`008`.

### US-CLI-020: Collect and Resolve Template-Aware Node Values

**As a graph owner, I want node input to understand the current template so that entering valid values is convenient without treating client checks as authoritative.**

Acceptance criteria:

- Interactive node operations retrieve the current template when appropriate.
- Prompts follow display order and show label, key, required status, expected type, validation rules, and known defaults.
- Non-interactive values can be supplied through repeated assignments, structured JSON, or standard input.
- Field keys accepted for convenience are resolved to stable field identifiers.
- Duplicate assignments to the same resolved field are rejected.
- Client validation is limited to usability checks.
- Defaults are not considered applied until confirmed by the backend.
- Explicit clear syntax sends `null` and does not overload an empty string.
- Omitted fields remain unchanged during updates.

Dependencies: US-CLI-007, US-CLI-018.

Design references: Sections 14.1–14.3, 14.5, 18.

Requirements: `FR-CLI-NODE-001`–`003`, `006`, `007`, `010`.

### US-CLI-021: Manage Nodes

**As a graph owner, I want to create, list, inspect, update, and delete nodes so that I can maintain graph entities from the terminal or automation.**

Acceptance criteria:

- `node create` submits collected values to the backend.
- `node list` uses bounded columns and pagination.
- `node show` associates returned values with labels, keys, and stable identifiers.
- JSON preserves canonical backend values without localizing dates, decimals, or booleans.
- `node update` patches only explicitly supplied values.
- Optional values can be cleared unambiguously.
- `node delete` warns that incoming and outgoing relationships will also be deleted.
- Destructive confirmation follows the common policy.
- Backend field-specific validation errors are preserved.
- Human and machine-readable outputs cover the complete lifecycle.

Dependencies: US-CLI-019, US-CLI-020.

Design references: Section 14.

Requirements: `FR-CLI-NODE-001`–`010`.

## Phase 6: Relationships, Querying, and Traversal

### US-CLI-022: Manage Directed Relationships

**As a graph owner, I want to manage directed relationships so that I can connect nodes and make edge direction unambiguous.**

Acceptance criteria:

- Relationships can be created, listed, shown, updated, and deleted.
- Creation requires graph, source node, target node, type, and optional label.
- Human output renders direction unambiguously.
- Relationship lists expose source, target, type, and identifier.
- Update patches only type or label and preserves resource-version safety.
- Deletion identifies the directed edge and follows the common confirmation policy.
- Backend graph-membership and ownership errors remain authoritative.
- Self-reference is not rejected locally unless the backend contract changes.

Dependencies: US-CLI-015, US-CLI-021.

Design references: Section 15.

Requirements: `FR-CLI-REL-*`.

### US-CLI-023: Filter, Sort, and Paginate Resource Lists

**As a user, I want consistent query and pagination controls so that I can inspect large graphs without downloading everything.**

Acceptance criteria:

- Backend-supported filters use structured options rather than raw SQL or JSON paths.
- Node filters accept stable field identifiers or unambiguous keys resolved through the template.
- Relationship filters support source, target, and relationship type.
- Sort options are checked against supported system or template fields.
- Human-readable commands retrieve one bounded page by default.
- Any interactive continuation prompt uses standard error and never appears non-interactively.
- JSON preserves opaque `nextCursor` and `hasMore` values.
- `--cursor` requests a subsequent page without interpreting the cursor.
- If `--all` is supported, it requires documented client-side safety limits.
- Interrupted all-page retrieval cannot appear to be a complete successful JSON result.

Dependencies: US-CLI-016, US-CLI-021, US-CLI-022.

Design references: Section 17.

Requirements: `FR-CLI-QUERY-*`, `FR-CLI-REL-003`.

### US-CLI-024: Traverse and Render Bounded Graphs

**As a user, I want to inspect connected nodes in a terminal-friendly representation so that I can understand a graph neighborhood without a graphical client.**

Acceptance criteria:

- `traverse` accepts graph, start node, direction, relationship types, depth, node limit, and relationship limit.
- The CLI never requests an unbounded traversal implicitly.
- Human output may use a tree-like presentation but does not assume the graph is a tree.
- Revisited nodes are marked rather than recursively expanded again.
- Terminal rendering has its own line or item safety limit.
- Backend truncation produces a visible human warning.
- JSON preserves nodes, relationships, depth data, cursors, and truncation metadata.
- A concise graph summary reports available template-field, node, and relationship counts.
- Tests cover cycles, revisited nodes, truncation, narrow terminals, and machine output.

Dependencies: US-CLI-017, US-CLI-022, US-CLI-023.

Design references: Section 16.

Requirements: `FR-CLI-VIEW-*`.

## Phase 7: File Values and Transfers

### US-CLI-025: Upload and Assign Local Files to Nodes

**As a graph owner, I want to use a local file for an image or file-reference field so that the CLI coordinates the backend's private upload workflow for me.**

Acceptance criteria:

- Node create and update accept a local file path for compatible fields.
- The CLI validates existence, readability, regular-file type, and configured local size limits.
- Upload authorization is requested from the backend.
- Files are streamed without loading the entire content into memory.
- Only headers permitted by the signed upload contract are sent.
- Signed URLs are treated as credentials and redacted.
- Upload completion occurs only after successful object transfer.
- Only the finalized file identifier is submitted as the node value.
- Progress is written only to standard error when appropriate.
- Cancellation propagates through authorization, transfer, completion, and node mutation.

Dependencies: US-CLI-020, US-CLI-021.

Design references: Sections 18.5, 21.1–21.2.

Requirements: `FR-CLI-NODE-011`.

### US-CLI-026: Report and Recover from Partial File Failures

**As a user, I want file-transfer phases reported accurately so that I know whether an upload, finalization, or node mutation succeeded.**

Acceptance criteria:

- Failures identify whether authorization, transfer, finalization, or node mutation failed.
- The CLI never claims the node references a file unless the backend confirms the mutation.
- A finalized but unreferenced file is reported accurately.
- Automatic cleanup is not attempted when final state is uncertain.
- Safe cleanup may be offered only for a known unreferenced finalized file.
- Upload retries occur only while authorization remains valid and the operation is safely repeatable.
- Expired authorization causes a new authorization request rather than modification of the signed URL.
- Partial outcomes use the documented error envelope and exit category.
- Tests cover failure at every upload phase and indeterminate responses.

Dependencies: US-CLI-011, US-CLI-025.

Design references: Sections 21.3–21.4.

Requirements: `FR-CLI-NODE-012`, `FR-CLI-ERR-008`.

## Phase 8: Security, Diagnostics, and Distribution

### US-CLI-027: Enforce Credential and Data Redaction

**As a user, I want secrets and private payloads redacted from every output path so that normal and verbose operation cannot leak sensitive information.**

Acceptance criteria:

- Access tokens, refresh tokens, authorization codes, user codes, client secrets, signed URLs, and authorization headers are always redacted.
- Full query strings containing secrets are not logged.
- Full node-value payloads and uploaded file contents are not logged.
- Verbose mode includes only approved diagnostic metadata.
- Redirect tests prove authorization headers cannot cross unapproved origins.
- Errors from configuration, authentication, HTTP, credential stores, and uploads are tested for leakage.
- The initial CLI sends no usage telemetry.

Dependencies: US-CLI-006, US-CLI-013, US-CLI-025.

Design references: Sections 10.6, 24, 27.

Requirements: `FR-CLI-AUTH-009`, `FR-CLI-CONFIG-006`, `FR-CLI-IO-008`.

### US-CLI-028: Provide Safe Diagnostics and Progress Reporting

**As a user or operator, I want correlatable diagnostics and unobtrusive progress so that I can troubleshoot commands without exposing graph contents or corrupting results.**

Acceptance criteria:

- The CLI generates or accepts a safe request identifier.
- Backend request identifiers are preserved and displayed on relevant errors.
- Verbose diagnostics may report CLI version, platform, active profile, redacted origin, API version, duration, and retry count.
- Progress appears only for meaningful long-running operations.
- Progress uses standard error and respects quiet mode.
- Progress is disabled when standard error is non-interactive unless explicitly requested.
- Diagnostics and progress never corrupt JSON or identifier-only output.
- Tests cover quiet, verbose, redirected, and JSON operation.

Dependencies: US-CLI-009, US-CLI-010, US-CLI-027.

Design references: Section 27.

### US-CLI-029: Generate Safe Shell Completions

**As an interactive user, I want shell completions so that commands and options are easier to discover and enter correctly.**

Acceptance criteria:

- Completion scripts are generated for the selected supported shells.
- Completion covers static commands and options.
- Completion does not require authentication.
- Completion does not make backend requests or enumerate private resources by default.
- Completion output never exposes configuration secrets.
- Installation instructions are documented for each supported shell.

Dependencies: US-CLI-003, US-CLI-001.

Design references: Sections 7.1, 26.

### US-CLI-030: Package and Distribute Verifiable CLI Artifacts

**As a user, I want installable, verifiable CLI releases so that I can run Graphopper on a supported platform without an undocumented development environment.**

Acceptance criteria:

- Versioned artifacts are produced for each supported platform and architecture.
- Artifacts contain no production credentials, tokens, user configuration, or private certificates.
- Integrity checksums are published.
- Artifact signatures are provided where selected by the distribution decision.
- Builds are reproducible or otherwise verifiable where practical.
- Installation, upgrade, and uninstall instructions are documented.
- Every artifact passes startup, help, version, configuration-path, credential-store, HTTPS, and Unicode smoke tests.
- Release packaging agrees with the platform and distribution decisions in `DESIGN.md`.

Dependencies: US-CLI-027, US-CLI-029.

Design references: Section 26.

## Phase 9: Hardening and Release Readiness

### US-CLI-031: Complete Compatibility and Safety Verification

**As a maintainer, I want the CLI's stable interfaces and safety guarantees comprehensively tested so that releases do not break automation or weaken protections.**

Acceptance criteria:

- Contract tests verify request paths, methods, authentication, schemas, errors, ETags, idempotency keys, cursors, and compatibility failures.
- Golden tests protect human and JSON output intentionally.
- Adapter tests cover configuration writes, permissions, credential storage, refresh, timeouts, redirects, retries, uploads, signals, and cancellation.
- Safety tests prove destructive prompt and `--yes` behavior.
- Tests prove `--non-interactive` never implies consent.
- Tests prove warnings and progress cannot corrupt JSON.
- Tests prove credentials and signed URLs are redacted on every error path.
- Tests prove partial or indeterminate mutations are not reported as successful.
- Supported platform behavior is exercised in the release test matrix.

Dependencies: All functional and infrastructure stories.

Design references: Sections 24, 25, 28.

### US-CLI-032: Complete End-to-End Release Verification

**As a user and maintainer, I want the complete CLI workflow verified against a test backend and identity provider so that the initial release is ready for interactive and automated use.**

Acceptance criteria:

- End-to-end tests cover login, status, profile selection, and logout.
- Tests create a graph and initial template.
- Tests exercise interactive and structured node creation.
- Tests create relationships and perform bounded traversal.
- Tests cover filtering, pagination, JSON output, and cursor continuation.
- Tests upload and reference a file.
- Tests verify resource-version conflicts.
- Tests verify destructive confirmations and backend cascades.
- Credentials are removed during logout.
- Unit, golden, adapter, contract, safety, end-to-end, cross-platform, and packaging suites pass.
- `REQUIREMENTS.md`, `DESIGN.md`, CLI help, backend contract expectations, and release documentation agree with implemented behavior.
- Remaining platform or distribution decisions are explicitly recorded.

Dependencies: US-CLI-030, US-CLI-031.

Design references: Sections 25–32.

## Dependency Summary

The primary delivery path is:

`Technology decisions -> CLI foundation -> configuration/input/output -> backend client -> credentials/authentication -> safety policy -> graph/template/node commands -> relationships/query/traversal -> files -> diagnostics/security -> packaging -> release verification`

Stories within a phase may be planned in parallel only when their dependencies are satisfied and they do not alter the same command contract, output schema, or security boundary.

The CLI also depends on the applicable `graphopper-backend` OpenAPI operations. A CLI story may use a conforming mock while the backend implementation is incomplete, but end-to-end completion requires the corresponding backend contract and behavior.

## Iteration Rules

For each story's later plan-implement-review iteration:

- Confirm the story agrees with `graphopper-cli/REQUIREMENTS.md` and `graphopper-cli/DESIGN.md`.
- Identify the backend API operations and contract version on which it depends.
- Resolve story-specific open decisions before implementation.
- Define commands, arguments, options, prompts, outputs, errors, and exit behavior.
- Implement the smallest complete interactive and automation-safe vertical slice.
- Keep HTTP, credential, filesystem, and presentation concerns behind their adapters.
- Add unit, golden, adapter, contract, safety, and end-to-end tests appropriate to the boundary.
- Review stream discipline, prompt behavior, redaction, cancellation, retries, concurrency, partial failure, and compatibility.
- Update help, examples, requirements, design decisions, and API expectations in the same iteration.
- Mark the story complete only when its acceptance criteria are demonstrably satisfied.
