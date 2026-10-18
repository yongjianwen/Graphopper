# graphopper-web Delivery Plan

## Purpose

This plan decomposes `DESIGN.md` into ordered, independently reviewable user stories. Each story shall pass through its own plan–implement–review iteration.

`REQUIREMENTS.md` defines observable behavior. `DESIGN.md` owns architectural decisions. This document defines delivery order, acceptance criteria, dependencies, and verification evidence.

## Delivery Status

Snapshot (2026-10-19): requirements and initial design are written; application implementation has not started. All stories below are `Pending`.

Use `Pending`, `Planning`, `Implementing`, `Reviewing`, `Complete`, or `Blocked`. A story is complete only when its acceptance criteria and applicable review checks have evidence. Documentation or conforming mocks alone do not prove production integration.

## Backend Dependencies and Delivery Gates

The backend currently provides an in-process API implementation and a tested PostgreSQL schema. Its durable repository, production object-storage adapter, cleanup worker, dependency readiness, and full OIDC integration remain unfinished.

Web foundation and feature work may use a synchronized contract and conforming test server while those adapters progress. Record every unavailable or incomplete API capability in the affected story. Resolve contract ambiguity with graphopper-backend; do not invent backend behavior or access its persistence directly.

Release requires a running backend with durable persistence, browser-compatible OIDC registration, usable upload/download authorization, approved CORS/origin configuration, and live integration verification. Backend changes require their own requirements, contract, and test updates.

## Iteration Rules

For every story:

1. **Plan:** read the relevant requirements/design sections, inspect the current API, resolve blocking decisions, define the exact scope and test evidence, and record external dependencies.
2. **Implement:** deliver the smallest complete slice, keeping source and tests within graphopper-web. Update affected documents and contract artifacts when behavior changes.
3. **Review:** check authorization assumptions, privacy, errors, concurrency, destructive consequences, accessibility, responsive behavior, and resource limits as applicable. Run the focused checks and record outcomes.
4. Mark complete only after the acceptance criteria are demonstrated. Distinguish mock verification, live integration, and manual review.
5. Keep recommendation-level requirements tracked even when deferred; record a rationale and follow-up owner/story.
6. Do not create graphopper-reactnative or speculative shared packages as part of this plan.

Accessibility, validation, privacy, loading/error states, and tests are part of each feature story. Later hardening stories verify the whole application and close integration gaps.

## Phase 1: Application and Integration Foundation

### US-WEB-001: Establish the Application Foundation

Status: `Pending`.

**As a maintainer, I want a runnable application with clear module boundaries so that I can implement features consistently.**

Acceptance criteria:

- Initialize the selected React, TypeScript, Vite, and npm stack with compatible pinned dependencies and a lockfile.
- Create application, API, authentication, components, feature, styling, and testing boundaries described in the design.
- Provide documented development, build, preview, formatting, linting, type-checking, and unit-test commands.
- Build a static artifact; exclude generated bundles, dependency caches, local configuration, and secrets from Git.
- Add a web-specific CI workflow and a minimal meaningful application-start verification.

Dependencies: None.

Design references: Sections 4.1–4.4, 7, 23.

Requirements: `FR-WEB-CONFIG-002`, `FR-WEB-TEST-001`.

### US-WEB-002: Validate Public Runtime Configuration

Status: `Pending`.

**As an operator, I want validated deployment configuration so that I can deploy one artifact safely across environments.**

Acceptance criteria:

- Load and validate public runtime configuration before protected routes render.
- Validate configuration version, API and OIDC URLs, client ID, scopes, callback locations, and application version.
- Reject insecure production endpoints and missing or malformed configuration with a recoverable startup view.
- Provide safe example configuration and document loopback HTTP exceptions for development.
- Verify that browser assets and runtime configuration contain no private credentials.

Dependencies: `US-WEB-001`.

Design references: Sections 6, 19.1, 23.

Requirements: `FR-WEB-CONFIG-001–004`, `FR-WEB-SUPPORT-002`.

### US-WEB-003: Build Accessible Presentation Foundations

Status: `Pending`.

**As a user, I want consistent accessible controls and feedback so that I can operate the application with my preferred input method.**

Acceptance criteria:

- Record the initial palette, typography, icon approach, and semantic design tokens before feature styling.
- Implement reusable buttons, labeled inputs, dialogs, feedback, error summaries, loading states, and empty states using semantic HTML and React Aria where appropriate.
- Support keyboard focus, safe dialog focus restoration, status announcements, contrast, adequate touch targets, and reduced motion.
- Apply light/dark operating-system preference and narrow, medium, and wide layout foundations.
- Verify representative controls with keyboard tests and automated accessibility checks.

Dependencies: `US-WEB-001`.

Design references: Sections 4.6, 16–18.

Requirements: `FR-WEB-CORE-001`, `FR-WEB-A11Y-001–008`, `FR-WEB-RESP-001`, `FR-WEB-PERF-003`.

### US-WEB-004: Establish Routing and the Application Shell

Status: `Pending`.

**As a user, I want predictable navigation and resource context so that I can move between graph workflows.**

Acceptance criteria:

- Implement the documented route structure and nested graph workspace layout.
- Provide graph-list, graph-context, account, sign-in, callback, and unknown-route entry points.
- Support direct links, browser back/forward behavior, meaningful page titles, skip navigation, and route focus handling.
- Provide initialization and unavailable-browser states without briefly exposing private content.
- Verify direct loading and navigation independently of authentication-provider integration.

Dependencies: `US-WEB-002`, `US-WEB-003`.

Design references: Sections 7–8, 16, 18.

Requirements: `FR-WEB-CORE-002–006`, `FR-WEB-RESP-004`.

### US-WEB-005: Synchronize the API Contract and Generate Types

Status: `Pending`.

**As a client maintainer, I want a reproducible transport contract so that I can detect backend incompatibility early.**

Acceptance criteria:

- Add an explicit contract-sync command accepting a versioned artifact, file, or URL and retain provenance/version information.
- Store the synchronized OpenAPI artifact within graphopper-web and generate transport types with the selected tooling.
- Do not import backend source or internal types.
- Validate consumed operations and required request/response shapes; record missing backend contract details as dependencies.
- Add CI regeneration checks that fail on stale generated output and tolerate additive response properties.

Dependencies: `US-WEB-001`.

Design references: Sections 4.4, 10, 22.3, 23.

Requirements: `FR-WEB-CONFIG-005–006`, `FR-WEB-TEST-002`.

### US-WEB-006: Implement the API and Error Boundary

Status: `Pending`.

**As a user, I want consistent API outcomes and actionable errors so that I can understand and recover from failed requests.**

Acceptance criteria:

- Build the typed client with injectable authentication, abort signals, deadlines, ETag capture, API-version checking, and backend-origin-only bearer headers.
- Normalize backend envelopes, network failures, timeouts, invalid responses, and unexpected failures into the application error model.
- Map field details and preserve request identifiers without exposing payloads or infrastructure details.
- Apply bounded safe-query retries and Retry-After handling; prohibit blind mutation retries.
- Retain one idempotency key per eligible creation attempt across ambiguous failures and retries.
- Test error mapping, cancellation, conditional headers, incompatible responses, credential redaction, and retry safety at the HTTP boundary.

Dependencies: `US-WEB-002`, `US-WEB-005`.

Design references: Sections 10, 15, 21.

Requirements: `FR-WEB-ERROR-003–009`, `FR-WEB-CONFIG-005–006`, `FR-WEB-SUPPORT-001`, `FR-WEB-CONCURRENCY-001,004`.

### US-WEB-007: Establish Server State and Mutation Patterns

Status: `Pending`.

**As a user, I want fresh resource data and reliable save feedback so that I can trust what the application presents.**

Acceptance criteria:

- Configure TanStack Query, centralized scoped query-key factories, staleness, bounded cache lifetime, and request cancellation.
- Keep server caches in memory and provide a complete cancel-and-clear operation for session changes.
- Define reusable confirmed-mutation, invalidation, duplicate-submission, and explicit-refresh patterns.
- Implement conflict presentation that retains a safe draft and requires deliberate refresh/resubmission.
- Do not infer totals or freshness from incomplete or stale collections.
- Verify invalidation, identity-change clearing, stale-version handling, and ambiguous creation retries.

Dependencies: `US-WEB-006`.

Design references: Sections 4.3, 9, 15–16.

Requirements: `FR-WEB-CORE-008`, `FR-WEB-CONCURRENCY-001–005`, `FR-WEB-ERROR-001–002`, `FR-WEB-SAFE-004`.

## Phase 2: Authentication and Sessions

### US-WEB-008: Implement OIDC Sign-In and Protected Routes

Status: `Pending`.

**As a user, I want secure browser sign-in so that I can access my private graph workspace.**

Acceptance criteria:

- Resolve and document test-provider registration, scopes, redirect URIs, and browser-flow support.
- Implement the AuthenticationService adapter with Authorization Code and PKCE using the selected OIDC library.
- Validate state, nonce, verifier, callback, and safe return path; remove callback parameters from history.
- Keep tokens in memory and only expiring transaction state in sessionStorage; disable sensitive library logging.
- Gate private routes on completed initialization and expose provider registration only when configured.
- Test invalid callbacks, unsafe return paths, token storage, and successful protected navigation.

Dependencies: `US-WEB-004`, `US-WEB-006`, `US-WEB-007`.

Design references: Sections 4.5, 5, 11, 19.

Requirements: `FR-WEB-AUTH-001–004,007–009`, `FR-WEB-SEC-003,005,008`.

### US-WEB-009: Manage Session Expiry, Current User, and Sign-Out

Status: `Pending`.

**As a user, I want clear account and session behavior so that I can know who I am signed in as.**

Acceptance criteria:

- Retrieve /me and display only basic account information plus safe application version/support details.
- Implement provider-supported renewal or controlled reauthentication with bounded redirect-loop protection.
- Distinguish backend authentication failure from inaccessible-resource responses.
- Clear private caches, requests, drafts, previews, and tokens on sign-out or identity change.
- Support provider logout where available without preventing local sign-out when the provider fails.
- Verify expiry, repeated 401 responses, provider failure, and two-user session transitions.

Dependencies: `US-WEB-008`.

Design references: Sections 9.4, 11, 21.

Requirements: `FR-WEB-AUTH-003,005–007`, `FR-WEB-SUPPORT-001–003`.

## Phase 3: Graph Management

### US-WEB-010: List and Create Graphs

Status: `Pending`.

**As a user, I want a graph library and creation workflow so that I can organize separate graph datasets.**

Acceptance criteria:

- Display owned graphs with cursor pagination, supported sorting, and distinct loading/empty/error states.
- Create graphs with a name and optional description, supporting an empty initial template.
- Provide initial-field creation using the shared field-definition controls when US-WEB-013 is available; this story may complete with that recommended enhancement explicitly tracked there.
- Use eligible idempotency keys and confirmed creation responses.
- Navigate to the created graph and invalidate the graph list.
- Test pagination, Unicode, validation, duplicate submission, and ambiguous creation failure.

Dependencies: `US-WEB-003`, `US-WEB-007`, `US-WEB-009`.

Design references: Sections 8–9, 12.1.

Requirements: `FR-WEB-GRAPH-001–004`, `FR-WEB-QUERY-004`, `FR-WEB-ERROR-001–004`.

### US-WEB-011: View and Edit Graph Metadata

Status: `Pending`.

**As a graph owner, I want a graph workspace and editable metadata so that I can maintain my graph's identity.**

Acceptance criteria:

- Load graph metadata and expose template, node, relationship, and visualization navigation.
- Edit only documented mutable properties and send the current version precondition.
- Warn before discarding dirty forms and distinguish pending, saved, and rejected states.
- Show counts only when authoritative or clearly label bounded collection counts.
- Handle unavailable graphs and stale versions without disclosing ownership or overwriting newer data.

Dependencies: `US-WEB-010`.

Design references: Sections 8, 12.1, 15.

Requirements: `FR-WEB-GRAPH-005–006`, `FR-WEB-CORE-003,007–008`, `FR-WEB-CONCURRENCY-001–003,005`.

### US-WEB-012: Delete Graphs Safely

Status: `Pending`.

**As a graph owner, I want an explicit graph-deletion workflow so that I can understand its cascading consequences.**

Acceptance criteria:

- Show the graph's meaningful name and template/node/relationship/file-association consequences before confirmation.
- Require an affirmative destructive action with safe cancel focus and pending-submission protection.
- Handle successful and documented repeated deletion consistently.
- Remove affected caches and leave the workspace only after confirmed success.
- Test cancellation, backend failure, unavailable resources, and successful cache cleanup.

Dependencies: `US-WEB-011`.

Design references: Sections 9.3, 12.1, 15.

Requirements: `FR-WEB-GRAPH-007–009`, `FR-WEB-SAFE-001–005`.

## Phase 4: Templates and Nodes

### US-WEB-013: Inspect Templates and Edit Field Definitions

Status: `Pending`.

**As a graph owner, I want ordered template fields and definition forms so that I can maintain the schema shared by my nodes.**

Acceptance criteria:

- Render ordered fields with stable IDs, labels, keys, types, required state, defaults, rules, descriptions, and display order.
- Implement reusable type-aware field-definition controls and non-destructive field edits.
- Add optional fields and support initial graph fields using the same controls.
- Preserve field IDs and distinguish default changes for future nodes from materialization.
- Send the authoritative graph/template precondition and map backend definition errors.
- Test ordering, reserved/duplicate keys, invalid defaults, supported field types, and stale versions.

Dependencies: `US-WEB-011`.

Design references: Sections 12.2–12.3, 15.

Requirements: `FR-WEB-TEMPLATE-001–005,009–010`, `FR-WEB-GRAPH-004`.

### US-WEB-014: Apply Template Migrations and Delete Fields

Status: `Pending`.

**As a graph owner, I want impact-aware schema changes so that I can avoid accidental graph-wide data loss.**

Acceptance criteria:

- Expose supported required-status, type-conversion, validation-rule, and default-materialization changes.
- Explain known graph-wide effects without inventing unavailable affected-node counts or conversion guarantees.
- Require destructive confirmation for field deletion and state that values on all nodes are removed.
- Handle migration conflicts, size limits, invalid existing values, and version failures while retaining safe input.
- Invalidate template, graph, node, traversal, and visualization caches according to impact.
- Test rejected migrations, successful migrations, deletion cancellation, and field-level error presentation.

Dependencies: `US-WEB-013`.

Design references: Sections 12.2, 15.

Requirements: `FR-WEB-TEMPLATE-006–008,010–011`, `FR-WEB-SAFE-001–005`.

### US-WEB-015: Build Canonical Dynamic Node Forms

Status: `Pending`.

**As a graph owner, I want forms generated from my template so that I can enter correct node values.**

Acceptance criteria:

- Implement the field-component registry for every supported type, including a file-field integration boundary.
- Keep field IDs as keys and use template labels, ordering, required state, and descriptions for presentation.
- Preserve unchanged, cleared, missing, defaulted, false, zero, and empty-text states distinctly.
- Submit integers, canonical decimal strings, date-only strings, and explicit-offset date-time values without precision or time-zone loss.
- Use documented usability rules and attach backend field errors; keep unmatched errors in the summary.
- Test canonical round trips, required/default behavior, optional clearing, Unicode, dates, decimals, and accessible labels.

Dependencies: `US-WEB-013`.

Design references: Sections 12.3, 18.3.

Requirements: `FR-WEB-NODE-002–006,011`, `FR-WEB-TEMPLATE-002`, `FR-WEB-RESP-005`.

### US-WEB-016: Create, Inspect, Edit, and Delete Nodes

Status: `Pending`.

**As a graph owner, I want complete node workflows so that I can maintain entities in my graph.**

Acceptance criteria:

- Provide bounded node listing, creation, direct detail links, and partial editing using the dynamic forms.
- Preserve ETags and send only intended changed or cleared values.
- Handle stale node/template responses and retain drafts safely.
- Confirm node deletion with an explicit warning about connected relationships.
- Invalidate connected relationship, graph-data, traversal, and node caches after confirmed changes.
- Test CRUD, defaults, validation, stale versions, inaccessible nodes, and deletion consequences.
- Treat managed upload/download completion as dependent on US-WEB-023–024.

Dependencies: `US-WEB-011`, `US-WEB-014`, `US-WEB-015`.

Design references: Sections 9, 12.3, 15.

Requirements: `FR-WEB-NODE-001–011`, `FR-WEB-SAFE-001–005`.

### US-WEB-017: Add Search, Filtering, Sorting, and Pagination Controls

Status: `Pending`.

**As a user, I want template-aware query controls so that I can find relevant nodes without downloading a graph.**

Acceptance criteria:

- Expose only documented field/operator combinations and supported system/template sort choices.
- Provide graph-scoped text search, visible active filters, clear controls, debounce, and cancellation.
- Normalize navigable query state in the URL without interpreting backend cursors.
- Reset cursor history when the query changes and provide bounded previous/next behavior.
- Distinguish no matches from query-limit errors and offer narrowing guidance.
- Test typed filters, changed-query pagination, unsupported options, URL history, and canceled stale responses.

Dependencies: `US-WEB-016`.

Design references: Sections 9, 12.5.

Requirements: `FR-WEB-QUERY-001–007`, `FR-WEB-PERF-001,004`.

## Phase 5: Relationships and Graph Exploration

### US-WEB-018: Manage Directed Relationships

Status: `Pending`.

**As a graph owner, I want complete relationship workflows so that I can connect entities in my graph.**

Acceptance criteria:

- Provide bounded paginated relationship lists, endpoint/type filters, direct details, creation, editing, and confirmed deletion.
- Select endpoints through bounded active-graph node search with meaningful labels and disambiguating IDs.
- Make source, target, and direction explicit in forms and details.
- Support accepted self-relations and parallel edges.
- Preserve update versions and invalidate connected detail, list, traversal, and graph-data caches.
- Test invalid/inaccessible endpoints, stale versions, Unicode labels, direction, and deletion.

Dependencies: `US-WEB-016`, `US-WEB-017`.

Design references: Sections 12.4, 15.

Requirements: `FR-WEB-REL-001–009`, `FR-WEB-SAFE-001–005`.

### US-WEB-019: Retrieve Bounded Graph Data with Accessible Lists

Status: `Pending`.

**As a user, I want a bounded graph snapshot and parallel lists so that I can inspect graph contents safely.**

Acceptance criteria:

- Map backend graph-data responses into neutral visual node/edge models and accessible node/relationship lists.
- Apply the documented node-label heuristic and keep full IDs available for copying.
- Communicate partial responses, pagination, result counts, and truncation without implying a complete graph.
- Enforce client soft and hard rendering thresholds before creating renderer elements.
- Preserve usable list/detail actions when visual rendering is refused or unavailable.
- Test empty graphs, partial data, parallel edges, label fallbacks, and limits.

Dependencies: `US-WEB-016`, `US-WEB-018`.

Design references: Sections 13.1–13.2, 13.4–13.5.

Requirements: `FR-WEB-VIEW-006–007,009`, `FR-WEB-PERF-001–002,004`.

### US-WEB-020: Explore Bounded Neighborhoods

Status: `Pending`.

**As a user, I want traversal controls and results so that I can explore relevant connections.**

Acceptance criteria:

- Provide starting-node selection, direction, type, and depth controls within backend limits.
- Render reached nodes, relationships, available depth, and truncation in the accessible result representation.
- Cancel superseded traversals and communicate timeouts and narrowing actions.
- Key traversal caches by graph and the complete bounded request.
- Test cycles, incoming/outgoing/both directions, empty neighborhoods, type filters, and oversized requests.

Dependencies: `US-WEB-017`, `US-WEB-018`, `US-WEB-019`.

Design references: Sections 10.4, 13.

Requirements: `FR-WEB-VIEW-005–006`, `FR-WEB-QUERY-006`, `FR-WEB-PERF-001–004`.

### US-WEB-021: Render and Navigate the Visual Graph

Status: `Pending`.

**As a user, I want an interactive visual graph so that I can understand connections spatially.**

Acceptance criteria:

- Implement the lazy-loaded Cytoscape adapter using neutral models and opaque selection events.
- Show directed edges and distinguish parallel edges and self-relations.
- Provide pan, zoom, reset, fit, and supported layout selection.
- Synchronize selection with details and accessible lists without resetting viewport during routine inspection.
- Destroy renderer instances and event listeners when leaving the view.
- Test adapter lifecycle, selection synchronization, soft-limit confirmation, and hard-limit fallback.

Dependencies: `US-WEB-019`, `US-WEB-020`.

Design references: Sections 4.7, 13, 20.

Requirements: `FR-WEB-VIEW-001–004,007–008`, `FR-WEB-RESP-002`, `FR-WEB-PERF-002`.

### US-WEB-022: Complete Accessible and Responsive Exploration

Status: `Pending`.

**As a user using keyboard, touch, or assistive technology, I want equivalent graph inspection controls so that I can complete graph workflows without depending on a canvas.**

Acceptance criteria:

- Complete synchronized keyboard-accessible node/relationship lists and details for every essential canvas action.
- Keep focus predictable and announce selection and truncation without unexpected focus moves.
- Honor reduced motion with stable fallback layouts and avoid keyboard traps.
- Adapt visualization controls and detail panes across narrow, medium, and wide layouts.
- Verify keyboard-only, touch, zoom/reflow, contrast, and representative screen-reader workflows.
- Record and resolve accessibility barriers before marking this story complete.

Dependencies: `US-WEB-003`, `US-WEB-021`.

Design references: Sections 13.3–13.5, 17–18.

Requirements: `FR-WEB-VIEW-008–010`, `FR-WEB-A11Y-001–008`, `FR-WEB-RESP-001–002`.

## Phase 6: Managed Files

### US-WEB-023: Authorize, Transfer, and Finalize Managed Uploads

Status: `Pending`.

**As a graph owner, I want an understandable private upload workflow so that I can attach ready files to nodes.**

Acceptance criteria:

- Resolve approved API/storage origins, media/size guidance, and transfer header behavior against the documented backend.
- Implement selected, authorizing, uploading, finalizing, ready, failed, and canceled states.
- Use the isolated transfer adapter for progress and cancellation; never attach an unready file ID.
- Send bearer credentials only to the API and only authorized transfer headers to signed storage URLs.
- Restrict transfer origins and ensure redirects cannot leak credentials or file bytes to unexpected origins.
- Distinguish upload, finalization, and node-save outcomes and obtain fresh authorization for safe retries.
- Test expiry, rejection, cancellation, metadata failure, progress, and signed-URL redaction.

Dependencies: `US-WEB-006`, `US-WEB-015`, `US-WEB-016`.

Design references: Sections 14.1–14.3, 19.

Requirements: `FR-WEB-FILE-001–006,008,011`, `FR-WEB-PERF-005`.

### US-WEB-024: Download, Replace, and Remove Files

Status: `Pending`.

**As a graph owner, I want authorized file access and lifecycle actions so that I can maintain node documents and images.**

Acceptance criteria:

- Request fresh backend authorization for private previews/downloads and discard expired signed URLs.
- Resolve and implement the PDF/active-content preview policy before enabling previews.
- Support permitted external HTTPS references with explicit safe navigation.
- Replace or clear optional file values through conditional node mutations.
- Provide directly managed-file deletion only through documented unreferenced-file behavior and explicit confirmation.
- Explain asynchronous cleanup without claiming immediate physical deletion.
- Release object URLs and file buffers and verify URLs/content never enter persistent storage or diagnostics.

Dependencies: `US-WEB-023`.

Design references: Sections 14.4, 15, 19.

Requirements: `FR-WEB-FILE-001,007–011`, `FR-WEB-SAFE-001–005`, `FR-WEB-SEC-002`.

## Phase 7: Hardening and Release

### US-WEB-025: Harden Browser Security and Safe Diagnostics

Status: `Pending`.

**As a user, I want private data and safe support information so that I can use the application without exposing credentials or graph contents.**

Acceptance criteria:

- Implement inert rendering, safe external links, validated navigation state, and the reviewed session protection behavior.
- Provide application version and copy-for-support details containing only approved metadata.
- Verify token, signed URL, filename, and graph-value exclusion from logs, errors, telemetry, storage, and support payloads.
- Document and test production CSP, HTTPS, referrer, MIME, permissions, and framing headers.
- Keep analytics disabled unless a later explicit privacy decision enables it.
- Run dependency/license checks and security tests including malicious text, stale callbacks, and cross-session cache isolation.

Dependencies: `US-WEB-009`, `US-WEB-014`, `US-WEB-018`, `US-WEB-022`, `US-WEB-024`.

Design references: Sections 19, 21.

Requirements: `FR-WEB-SEC-001–008`, `FR-WEB-ERROR-009`, `FR-WEB-SUPPORT-001–004`, `FR-WEB-TEST-006`.

### US-WEB-026: Measure Performance and Browser Compatibility

Status: `Pending`.

**As a user, I want responsive behavior within published limits so that I can work with graphs on supported devices.**

Acceptance criteria:

- Record reference hardware, network conditions, dataset sizes, concrete browser minimums, and release test versions.
- Measure gzip budgets for initial JavaScript, lazy visualization, and CSS against the design.
- Measure LCP, INP, CLS, ordinary interaction long tasks, and graph rendering near the soft/hard limits.
- Exercise current Playwright Chromium, Firefox, and WebKit plus representative touch viewports.
- Add incremental loading, targeted memoization, or accessible virtualization only when measurements justify it.
- Fail release checks on unmet budgets or record an approved design revision with evidence.
- Capture stable responsive/light/dark visual baselines and actionable compatibility guidance.

Dependencies: `US-WEB-022`, `US-WEB-024`.

Design references: Sections 18, 20, 22.6.

Requirements: `FR-WEB-RESP-001–005`, `FR-WEB-PERF-001–006`, `FR-WEB-TEST-005`.

### US-WEB-027: Verify End-to-End API and Ownership Workflows

Status: `Pending`.

**As a user and maintainer, I want a complete tested browser workflow so that I can trust integration with the authoritative backend.**

Acceptance criteria:

- Run the complete graph/template/node/relationship/traversal/file lifecycle against a real test backend and deterministic OIDC provider.
- Use at least two users and verify identifier probing, denied resource access, and sign-out/user-switch isolation.
- Exercise stale versions, template migration errors, expired authentication, ambiguous writes, network failures, and file expiry.
- Verify actual requests/responses, headers, pagination, stable error codes, and additive response compatibility.
- Run accessibility automation and document manual keyboard/screen-reader results.
- Do not treat conforming mocks as evidence that live PostgreSQL, OIDC, or object-storage integration passed.

Dependencies: `US-WEB-012`, `US-WEB-014`, `US-WEB-017`, `US-WEB-018`, `US-WEB-022`, `US-WEB-024`, `US-WEB-025`, `US-WEB-026`.

Design references: Sections 22, 24.

Requirements: `FR-WEB-TEST-001–007`.

### US-WEB-028: Prepare Static Deployment and Release

Status: `Pending`.

**As an operator, I want a reproducible verified release so that I can deploy and recover the web application.**

Acceptance criteria:

- Document build, runtime configuration, supported browsers, provider registration, trusted origins, and operational ownership.
- Verify HTTPS, security headers, SPA deep links, callback routes, immutable assets, and index/config cache policies on a staging host.
- Provide artifact versioning, deployment rollback, configuration validation, and old-client/API compatibility procedures.
- Run the complete release workflow against the production build and staging services.
- Document all remaining deployment decisions and known limitations with explicit release impact.
- Review requirements/design/contract agreement and mark release ready only when required stories and live verification are complete.

Dependencies: `US-WEB-002`, `US-WEB-025`, `US-WEB-026`, `US-WEB-027`.

Design references: Sections 6, 19, 21, 23, 26.

Requirements: `FR-WEB-CONFIG-001–005`, `FR-WEB-RESP-003–004`, `FR-WEB-SUPPORT-001–004`, `FR-WEB-TEST-001–007`.

## Dependency and Milestone Summary

| Milestone | Stories | Demonstrable outcome |
| --- | --- | --- |
| Foundation | US-WEB-001–007 | Runnable accessible shell, configuration, typed API, errors, and cache patterns |
| Authenticated entry | US-WEB-008–009 | Secure sign-in, current user, expiry, and sign-out |
| Graph workspace | US-WEB-010–012 | Graph library and safe graph lifecycle |
| Schema and entities | US-WEB-013–017 | Template migrations, dynamic forms, nodes, and queries |
| Connections and exploration | US-WEB-018–022 | Relationships, traversal, bounded visualization, and accessible alternatives |
| Managed files | US-WEB-023–024 | Authorized upload, attachment, download, replacement, and removal |
| Release | US-WEB-025–028 | Security, measured performance, live integration, and deployable artifact |

Within a phase, work may proceed independently only when its explicit dependencies are satisfied and overlapping interfaces are agreed. Phase numbering does not override story dependencies.

## Requirements Coverage

Every requirement group has primary delivery ownership below; feature-specific acceptance criteria remain the source for individual behavior.

| Requirement group | Primary stories |
| --- | --- |
| `FR-WEB-CORE-*` | 003–004, 007, 011 |
| `FR-WEB-CONFIG-*` | 001–002, 005–006, 028 |
| `FR-WEB-AUTH-*` | 008–009 |
| `FR-WEB-GRAPH-*` | 010–013 |
| `FR-WEB-TEMPLATE-*` | 013–015 |
| `FR-WEB-NODE-*` | 015–017, 023–024 |
| `FR-WEB-REL-*` | 018 |
| `FR-WEB-VIEW-*` | 019–022 |
| `FR-WEB-QUERY-*` | 010, 017–020 |
| `FR-WEB-FILE-*` | 023–024 |
| `FR-WEB-CONCURRENCY-*` | 006–007, 011, 013–018 |
| `FR-WEB-ERROR-*` | 003, 006–007, feature stories, 025 |
| `FR-WEB-SAFE-*` | 007, 012, 014, 016, 018, 024 |
| `FR-WEB-A11Y-*` | 003, all UI stories, 022, 027 |
| `FR-WEB-RESP-*` | 003–004, 015, 022, 026 |
| `FR-WEB-SEC-*` | 002, 008–009, 023–025 |
| `FR-WEB-PERF-*` | 003, 017, 019–024, 026 |
| `FR-WEB-SUPPORT-*` | 002, 006, 009, 025, 028 |
| `FR-WEB-TEST-*` | Every feature story, 025–028 |

## Planning Decisions to Resolve at the Relevant Story

- **US-WEB-001:** compatible pinned dependency versions and clean project commands.
- **US-WEB-003:** visual tokens, typography, icons, and initial reusable control scope.
- **US-WEB-005:** contract artifact provenance and handling of incomplete backend response schemas.
- **US-WEB-008–009:** OIDC provider/test registration, audience/scopes, renewal, and logout behavior.
- **US-WEB-023–024:** storage origin policy, safe redirects, upload headers, and active-content preview policy.
- **US-WEB-025:** exact deployment security headers and privacy-safe diagnostic inventory.
- **US-WEB-026:** reference devices/network, browser versions, measured fixtures, and performance budgets.
- **US-WEB-028:** hosting/CDN, public origins, operational owners, and rollback process.

Decisions that alter architecture shall be recorded in `DESIGN.md` before dependent implementation. An optional remote telemetry service or PWA installation flow requires an explicit scope change.

## Completion Evidence

Each reviewed story should append a short evidence record containing:

- Story ID and date.
- Implemented scope and any explicitly deferred recommendations.
- Focused automated checks and their results.
- Manual accessibility/responsive checks when applicable.
- Contract version and backend environment used.
- Remaining issues and their impact on completion or release.

Do not mark the application production-ready while required live backend, OIDC, storage, accessibility, or deployment verification remains incomplete.
