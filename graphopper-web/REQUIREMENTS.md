# graphopper-web Functional Requirements

## 1. Purpose

graphopper-web is the browser-based client for graphopper-backend. It enables people to authenticate, manage graph-structured data, and explore graphs visually without installing a command-line or mobile application.

graphopper-web shall consume graphopper-backend's documented API and shall not access backend persistence directly.

graphopper-backend remains authoritative for authentication, authorization, ownership, persistence, validation, referential integrity, deletion consequences, file rules, pagination, filtering, search, traversal, stable errors, and resource representations. Client-side validation exists for usability and is not a security boundary.

## 2. Initial Scope

The initial web application shall support:

- Authentication, current-user presentation, and sign-out
- Graph creation, listing, retrieval, editing, and deletion
- Node-template inspection and management
- Node creation, listing, retrieval, editing, and deletion
- Relationship creation, listing, retrieval, editing, and deletion
- Interactive visualization of bounded graphs and neighborhoods
- Backend-supported filtering, searching, sorting, pagination, and traversal
- Managed-file upload, download, replacement, and removal
- Accessible and responsive interaction
- Consistent loading, empty, success, validation, conflict, authentication, authorization, and service-failure states

## 3. Users and Interaction Context

### 3.1 Authenticated User

An authenticated user manages and visualizes only graph data made available to them by graphopper-backend.

### 3.2 Unauthenticated Visitor

An unauthenticated visitor may access a sign-in entry point and non-sensitive application information. They shall not be shown private graph data.

### 3.3 Interaction Modes

The application shall support pointer, keyboard, and touch interaction for essential workflows. A visual graph canvas may provide enhanced pointer or touch interaction, but an accessible alternative shall remain available for essential graph information and actions.

## 4. Application Shell and Navigation

### FR-WEB-CORE-001: Product Identity

The application shall use the name `graphopper-web` in technical documentation and Graphopper in user-facing product presentation.

### FR-WEB-CORE-002: Primary Navigation

The application shall provide consistent navigation to the user's graph list, the active graph when one is selected, account controls, and sign-out.

### FR-WEB-CORE-003: Resource Context

A page operating on a graph-owned resource shall clearly identify the active graph and resource context.

### FR-WEB-CORE-004: Direct Navigation

The application shall support direct browser navigation to stable application pages for graphs and graph-owned resources where practical.

### FR-WEB-CORE-005: Browser History

Navigation shall integrate with browser back and forward behavior without losing already-saved backend state.

### FR-WEB-CORE-006: Unknown Route

An unknown application route shall show a recoverable not-found view with a path to a known application location.

### FR-WEB-CORE-007: Unsaved Changes

When navigation would discard unsaved user input, the application shall warn the user or preserve the draft for the current session.

### FR-WEB-CORE-008: Save State

Forms shall clearly communicate whether changes are unsaved, being submitted, saved, or rejected.

## 5. Configuration and Backend Compatibility

### FR-WEB-CONFIG-001: Backend API

The application shall communicate with a configured graphopper-backend base URL using its documented versioned API.

### FR-WEB-CONFIG-002: Application Boundary

The application shall not connect directly to graphopper-backend's database, internal queues, or private object-storage credentials.

### FR-WEB-CONFIG-003: Deployment Configuration

Deployment-specific non-secret settings shall be configurable without modifying application source code.

### FR-WEB-CONFIG-004: Secret Exclusion

Backend credentials, identity-provider client secrets, signing keys, and object-storage credentials shall not be embedded in browser-delivered assets.

### FR-WEB-CONFIG-005: API Compatibility

The application shall detect and report an unsupported graphopper-backend API version rather than continuing with behavior known to be incompatible.

### FR-WEB-CONFIG-006: Opaque Values

Backend resource identifiers and pagination cursors shall be treated as opaque values. The application shall not infer authorization, ordering, timestamps, or resource meaning from their structure.

## 6. Authentication and Session Behavior

### FR-WEB-AUTH-001: Sign-In

The application shall allow an unauthenticated visitor to begin the configured browser-compatible authentication flow.

### FR-WEB-AUTH-002: Authentication Return

After successful authentication, the application should return the user to the safe application location they originally requested.

### FR-WEB-AUTH-003: Current User

The application shall retrieve and display the authenticated user's available basic account information without exposing authentication claims or credentials unnecessarily.

### FR-WEB-AUTH-004: Protected Views

Private graph views and operations shall require an authenticated session.

### FR-WEB-AUTH-005: Invalid Session

When authentication expires or becomes invalid, the application shall stop presenting affected operations as successful, clear private in-memory state as appropriate, and direct the user to authenticate again.

### FR-WEB-AUTH-006: Sign-Out

The application shall provide a visible sign-out action that clears the local session and invokes provider or backend sign-out behavior when supported.

### FR-WEB-AUTH-007: Credential Confidentiality

Authentication credentials shall not appear in application URLs, user-visible errors, diagnostics, analytics, application-generated browser console output, or persisted drafts.

### FR-WEB-AUTH-008: Credential Storage

The application shall use a browser-appropriate credential mechanism designed to reduce exposure to injected script and cross-site request attacks. The exact mechanism shall be selected in `DESIGN.md`.

### FR-WEB-AUTH-009: Registration

When self-registration is enabled by the configured identity provider, the sign-in experience may expose the provider's registration path. graphopper-web shall not implement a separate password store.

## 7. Graph Management

### FR-WEB-GRAPH-001: List Graphs

The application shall display the graphs returned for the authenticated user and shall support loading additional pages when available.

### FR-WEB-GRAPH-002: Empty Graph List

When the user has no graphs, the application shall display an empty state with an available create-graph action.

### FR-WEB-GRAPH-003: Create Graph

The application shall allow the user to create a graph with a name and optional description.

### FR-WEB-GRAPH-004: Initial Template

The graph-creation workflow should allow the user to create an empty template or define supported initial template fields.

### FR-WEB-GRAPH-005: Graph Workspace

The application shall provide a graph workspace showing graph metadata and access to its template, nodes, relationships, and visualization.

### FR-WEB-GRAPH-006: Edit Graph

The application shall allow the user to edit backend-supported graph metadata without presenting ownership or system-managed properties as editable.

### FR-WEB-GRAPH-007: Delete Graph

The application shall allow the user to delete a graph they can access.

### FR-WEB-GRAPH-008: Graph Deletion Confirmation

Before graph deletion, the application shall require explicit confirmation and state that the template, nodes, relationships, and file associations become unavailable according to backend deletion rules.

### FR-WEB-GRAPH-009: Deleted Graph State

After successful graph deletion, the application shall remove the graph from locally presented collections, leave the deleted workspace, and avoid presenting cached graph contents as active.

## 8. Node-Template Management

### FR-WEB-TEMPLATE-001: View Template

The application shall display the active graph's complete ordered node template.

### FR-WEB-TEMPLATE-002: Supported Field Types

The application shall present input controls for every template field type supported by graphopper-backend, including text, long text, integer, decimal, Boolean, date, date-time, URL, and file reference.

### FR-WEB-TEMPLATE-003: Add Field

The application shall allow the user to add a template field using backend-supported field properties.

### FR-WEB-TEMPLATE-004: Edit Field

The application shall allow the user to edit backend-supported mutable field properties while treating the stable field identifier as immutable.

### FR-WEB-TEMPLATE-005: Field Ordering

The application shall allow field display order to be set or changed when supported by graphopper-backend.

### FR-WEB-TEMPLATE-006: Delete Field

The application shall allow a template field to be deleted only after explicit destructive confirmation.

### FR-WEB-TEMPLATE-007: Field Deletion Consequence

The field-deletion confirmation shall state that the field's values are removed from every node in the graph.

### FR-WEB-TEMPLATE-008: Impactful Changes

Before submitting a type change, optional-to-required change, materialized default, or other graph-wide migration, the application shall explain the expected impact that can be determined from the API contract or backend response.

### FR-WEB-TEMPLATE-009: Template Validation

The application should validate field definitions for immediate usability, but it shall submit authoritative decisions to graphopper-backend and render backend validation details.

### FR-WEB-TEMPLATE-010: Template Concurrency

Template mutations shall include the backend-provided current version precondition. A stale-version response shall not be presented as a successful mutation.

### FR-WEB-TEMPLATE-011: Migration Failure

If a template migration fails, the application shall preserve submitted form values where safe, show the backend error, and refresh or offer to refresh the authoritative template state.

## 9. Node Management

### FR-WEB-NODE-001: List Nodes

The application shall display a bounded, paginated list of nodes belonging to the active graph.

### FR-WEB-NODE-002: Template-Aware Presentation

Node values shall be displayed using the current template's labels, order, types, and supported formatting rather than exposing only field identifiers.

### FR-WEB-NODE-003: Create Node

The application shall generate a node-creation form from the active template and clearly identify required fields.

### FR-WEB-NODE-004: Edit Node

The application shall allow supported node values to be edited without requiring unchanged values to be re-entered.

### FR-WEB-NODE-005: Clear Optional Value

The application shall provide an unambiguous way to clear an optional node value, distinct from leaving the value unchanged.

### FR-WEB-NODE-006: Node Validation

The application should perform type-appropriate and template-aware validation for usability. It shall render field-specific backend validation errors and shall not claim success when graphopper-backend rejects the values.

### FR-WEB-NODE-007: View Node

The application shall provide a detailed view of a selected node and its template-defined values.

### FR-WEB-NODE-008: Delete Node

The application shall allow a node to be deleted after explicit confirmation.

### FR-WEB-NODE-009: Node Deletion Consequence

The node-deletion confirmation shall warn that incoming and outgoing relationships connected to the node are also removed.

### FR-WEB-NODE-010: Node Concurrency

When a node version is available, updates shall include the appropriate version precondition and shall handle stale-version responses explicitly.

### FR-WEB-NODE-011: Unicode Values

Node forms and presentations shall preserve supported Unicode text without lossy conversion.

## 10. Relationship Management

### FR-WEB-REL-001: Create Relationship

The application shall allow a directed relationship to be created between two nodes in the active graph.

### FR-WEB-REL-002: Endpoint Selection

Relationship endpoint controls shall help the user select nodes from the active graph and shall not intentionally offer nodes from another graph.

### FR-WEB-REL-003: Direction

Relationship creation and detail views shall clearly distinguish source and target nodes.

### FR-WEB-REL-004: List Relationships

The application shall display a bounded, paginated list of relationships in the active graph.

### FR-WEB-REL-005: Filter Relationships

The relationship list shall expose backend-supported filtering by source, target, and relationship type.

### FR-WEB-REL-006: View Relationship

The application shall display a selected relationship's direction, endpoints, type, label, and available system metadata.

### FR-WEB-REL-007: Edit Relationship

The application shall allow backend-supported relationship properties to be edited.

### FR-WEB-REL-008: Delete Relationship

The application shall allow a relationship to be deleted after explicit confirmation.

### FR-WEB-REL-009: Relationship Concurrency

When a relationship version is available, updates shall include the appropriate version precondition and shall handle stale-version responses explicitly.

## 11. Graph Visualization and Traversal

### FR-WEB-VIEW-001: Visual Graph

The application shall provide an interactive visual representation of a bounded graph or graph neighborhood.

### FR-WEB-VIEW-002: Directed Edges

The visualization shall communicate relationship direction and shall distinguish parallel relationships where practical.

### FR-WEB-VIEW-003: Resource Selection

The user shall be able to select a visualized node or relationship and inspect its available details.

### FR-WEB-VIEW-004: Navigation Controls

The visualization should provide pan, zoom, reset, and fit-to-content controls.

### FR-WEB-VIEW-005: Traversal Controls

The user shall be able to request a bounded neighborhood using backend-supported starting-node, direction, relationship-type, and depth controls.

### FR-WEB-VIEW-006: Result Limits

The application shall not request or render an unbounded graph. It shall communicate truncation or additional-page availability when graphopper-backend limits a result.

### FR-WEB-VIEW-007: Empty Graph

An empty graph shall display a useful empty state rather than a broken or indefinitely loading visualization.

### FR-WEB-VIEW-008: View Stability

Routine detail inspection should not unnecessarily discard the user's viewport or selection.

### FR-WEB-VIEW-009: Accessible Alternative

Essential information and actions available through the visualization shall also be available through keyboard-accessible lists, details, or equivalent controls.

### FR-WEB-VIEW-010: Reduced Motion

Visualization animation shall respect the user's reduced-motion preference where animation is not essential.

## 12. Search, Filtering, Sorting, and Pagination

### FR-WEB-QUERY-001: Node Filtering

The application shall expose backend-supported node filters using template-aware labels and type-appropriate controls.

### FR-WEB-QUERY-002: Node Search

The application shall allow supported textual node fields to be searched within the active graph.

### FR-WEB-QUERY-003: Sorting

Lists shall expose supported deterministic sort choices without accepting arbitrary backend expressions from ordinary users.

### FR-WEB-QUERY-004: Pagination

The application shall support backend cursor pagination without requiring users to read or edit cursor values.

### FR-WEB-QUERY-005: Query State

Active filters, searches, and sorts shall be visible and removable.

### FR-WEB-QUERY-006: Query Limits

When a query exceeds backend limits, the application shall explain that the request needs to be narrowed rather than treating it as an empty result.

### FR-WEB-QUERY-007: Graph Scope

The initial application shall not imply that node search spans graphs when the backend query is scoped to one graph.

## 13. Managed Files and External References

### FR-WEB-FILE-001: File-Aware Input

For compatible template fields, the application shall allow the user to choose a local file for managed upload or provide an external HTTPS reference when allowed by the backend field policy.

### FR-WEB-FILE-002: Upload Guidance

Before upload, the application should communicate accepted media types and size limits known from configuration or the backend contract.

### FR-WEB-FILE-003: Authorized Upload

Managed uploads shall use the backend-authorized upload workflow and shall not expose permanent public storage credentials or raw private object keys.

### FR-WEB-FILE-004: Upload Progress

The application shall communicate upload progress or activity, successful finalization, and failure.

### FR-WEB-FILE-005: Upload Completion

A managed file shall not be presented as attachable or successfully saved until graphopper-backend confirms it is ready.

### FR-WEB-FILE-006: Upload Failure

If upload or completion fails, the application shall distinguish the file failure from the node mutation outcome and shall not claim that an unattached file was saved to the node.

### FR-WEB-FILE-007: Authorized Download

Private file download or preview shall begin only after graphopper-backend authorizes the current request.

### FR-WEB-FILE-008: Expiring URLs

The application shall treat signed upload and download URLs as short-lived and shall request new authorization instead of persisting or reusing an expired URL.

### FR-WEB-FILE-009: Replace File

The application shall allow a compatible node file value to be replaced.

### FR-WEB-FILE-010: Remove File

The application shall allow an optional node file value to be cleared and shall communicate backend-managed cleanup without claiming immediate physical deletion unless confirmed.

### FR-WEB-FILE-011: File Privacy

Signed URLs, file contents, and file metadata not intended for display shall not be included in analytics or diagnostic output produced by the application.

## 14. Concurrency and Data Freshness

### FR-WEB-CONCURRENCY-001: Version Preservation

The application shall preserve backend resource versions or ETags needed for conditional mutations.

### FR-WEB-CONCURRENCY-002: Conflict Handling

When a mutation is rejected because the resource version is stale, the application shall explain that the resource changed and offer a safe way to reload authoritative state.

### FR-WEB-CONCURRENCY-003: No Silent Overwrite

The application shall not automatically retry a rejected non-idempotent update in a way that silently overwrites a newer resource version.

### FR-WEB-CONCURRENCY-004: Creation Retry

Where graphopper-backend supports idempotency keys, the application should use them for creation requests that may be retried after an ambiguous transport failure.

### FR-WEB-CONCURRENCY-005: Refresh

The user shall have a way to refresh active resource data from graphopper-backend.

## 15. Loading, Errors, and Resilience

### FR-WEB-ERROR-001: Loading State

Every backend-dependent view shall communicate loading without presenting stale data as newly confirmed.

### FR-WEB-ERROR-002: Empty State

Lists and workspaces shall distinguish an empty successful result from loading and failure.

### FR-WEB-ERROR-003: Stable Backend Errors

The application shall use backend machine-readable error codes when selecting user-facing behavior and shall preserve the backend request identifier for support diagnostics.

### FR-WEB-ERROR-004: Validation Details

Backend field-level validation details shall be associated with relevant form controls when possible and shall remain available in an error summary.

### FR-WEB-ERROR-005: Non-Disclosure

Missing and inaccessible private resources shall use the same unavailable-resource presentation when graphopper-backend intentionally does not distinguish them.

### FR-WEB-ERROR-006: Connectivity Failure

When graphopper-backend cannot be reached, the application shall communicate the failure and offer a safe retry where appropriate.

### FR-WEB-ERROR-007: Unexpected Response

An unexpected or incompatible response shall produce a recoverable application error and shall not be interpreted as a successful mutation.

### FR-WEB-ERROR-008: Retry Safety

Automatic retries shall be limited to operations known to be safe or idempotent. Other retries shall require an idempotency mechanism or explicit user action.

### FR-WEB-ERROR-009: Error Privacy

User-visible errors shall not include bearer tokens, signed URLs, credentials, stack traces, raw private node payloads, or infrastructure details.

## 16. Confirmation and Destructive Safety

### FR-WEB-SAFE-001: Explicit Confirmation

Graph, node, relationship, template-field, and directly managed-file deletions shall require explicit confirmation appropriate to their consequences.

### FR-WEB-SAFE-002: Identified Target

Confirmation interfaces shall identify the resource using a meaningful available label and shall not rely only on an opaque identifier.

### FR-WEB-SAFE-003: Consequence Disclosure

Confirmations shall state known cascading or destructive consequences before submission.

### FR-WEB-SAFE-004: Duplicate Submission

While a mutation is in progress, the application shall prevent accidental duplicate submission or use a backend-supported idempotency mechanism.

### FR-WEB-SAFE-005: Server Authority

Hiding or disabling an action shall not be treated as authorization. The graphopper-backend response remains authoritative.

## 17. Accessibility

### FR-WEB-A11Y-001: Accessibility Target

The application shall target WCAG 2.2 Level AA for initial user-facing workflows.

### FR-WEB-A11Y-002: Keyboard Operation

All essential workflows shall be operable using a keyboard without requiring pointer gestures.

### FR-WEB-A11Y-003: Focus Management

Navigation, dialogs, validation failures, asynchronous updates, and destructive confirmations shall manage focus predictably.

### FR-WEB-A11Y-004: Semantic Structure

Pages shall use meaningful headings, landmarks, labels, names, roles, and states that assistive technologies can interpret.

### FR-WEB-A11Y-005: Status Announcements

Important asynchronous status changes and validation summaries shall be exposed to assistive technologies without unnecessarily interrupting the user.

### FR-WEB-A11Y-006: Color Independence

Information, selection, validation, and relationship direction shall not be communicated by color alone.

### FR-WEB-A11Y-007: Contrast and Scaling

Text and interactive controls shall meet the selected accessibility contrast target and remain usable under browser text and page zoom.

### FR-WEB-A11Y-008: Touch Targets

Essential touch controls shall provide adequate target size and spacing for supported touch devices.

## 18. Responsive and Browser Behavior

### FR-WEB-RESP-001: Responsive Layout

Core graph-management workflows shall remain usable across supported desktop, tablet, and narrow mobile browser viewports.

### FR-WEB-RESP-002: Visualization Adaptation

The visualization may adapt its controls and detail layout for smaller screens, but essential inspection and management actions shall remain available.

### FR-WEB-RESP-003: Browser Support

The application shall publish and test a supported browser policy. The exact browser and version matrix shall be selected in `DESIGN.md`.

### FR-WEB-RESP-004: Unsupported Browser

When a browser lacks a capability required for safe operation, the application shall display actionable guidance rather than failing silently.

### FR-WEB-RESP-005: Unicode and Locale

The application shall preserve Unicode names, labels, relationship types, and textual values. Initial localization and display-locale policy are defined in `DESIGN.md`.

## 19. Security and Privacy

### FR-WEB-SEC-001: Untrusted Content

Graph names, labels, node values, relationship values, filenames, backend errors, and URL-derived state shall be treated as untrusted content and shall not execute as markup or script.

### FR-WEB-SEC-002: External Navigation

User-provided external URLs shall be displayed and opened using controls that reduce opener and phishing risks. The application shall not silently navigate to them.

### FR-WEB-SEC-003: Request Forgery Protection

The selected browser session design shall protect state-changing requests against cross-site request forgery where applicable.

### FR-WEB-SEC-004: Content Policy

The deployed application shall use a restrictive content-loading policy appropriate to required scripts, styles, images, API, identity-provider, and file endpoints.

### FR-WEB-SEC-005: Private Cache State

Private graph data shall not be persisted in broadly accessible browser storage by default. Any deliberate local persistence shall be documented, bounded, and cleared appropriately on sign-out.

### FR-WEB-SEC-006: Logging Privacy

Application diagnostics shall exclude credentials, signed URLs, file contents, and complete private graph payloads by default.

### FR-WEB-SEC-007: Analytics Privacy

If analytics are introduced, they shall not collect node values, graph contents, credentials, signed URLs, or uploaded file contents.

### FR-WEB-SEC-008: Authorization Assumptions

The application shall not infer access from cached ownership or possession of an identifier. It shall treat graphopper-backend authorization decisions as authoritative.

## 20. Performance and Resource Use

### FR-WEB-PERF-001: Bounded Retrieval

The application shall use paginated, bounded, or traversal-specific backend endpoints rather than fetching an unbounded dataset.

### FR-WEB-PERF-002: Bounded Rendering

Lists and visualizations shall apply documented rendering limits appropriate to supported devices and shall communicate when the displayed result is partial.

### FR-WEB-PERF-003: Interaction Feedback

Operations that may take noticeable time shall provide timely activity feedback and prevent ambiguous repeated submission.

### FR-WEB-PERF-004: Incremental Loading

The application should load additional list or graph data incrementally where graphopper-backend provides pagination or bounded traversal.

### FR-WEB-PERF-005: Uploaded Resources

The application shall avoid decoding or retaining uploaded files in browser memory longer than required for the selected operation.

### FR-WEB-PERF-006: Measured Targets

Initial loading, interaction, bundle, and visualization performance targets shall be defined in `DESIGN.md` or `PLAN.md` and verified before release.

## 21. Diagnostics and Supportability

### FR-WEB-SUPPORT-001: Request Identifier

When a backend error includes a request identifier, the application shall make it available through an error-details or copy-for-support interaction.

### FR-WEB-SUPPORT-002: Application Version

The deployed application shall expose its application version or build identifier in a non-sensitive support location.

### FR-WEB-SUPPORT-003: Safe Diagnostics

Any user-accessible diagnostic view shall redact credentials, signed URLs, and private graph values while including sufficient version and request information for troubleshooting.

### FR-WEB-SUPPORT-004: Backend Health

The application may use public backend health or compatibility information to improve error reporting, but it shall not expose internal dependency details unavailable from the public API.

## 22. Verification Requirements

### FR-WEB-TEST-001: Core Workflow Tests

Automated tests shall cover authentication state, graphs, templates, nodes, relationships, visualization entry points, files, and destructive confirmations.

### FR-WEB-TEST-002: API Contract Tests

Tests shall verify the behavior on which graphopper-web relies against the checked-in graphopper-backend OpenAPI contract or a contract-conforming test server.

### FR-WEB-TEST-003: Error and Concurrency Tests

Tests shall cover validation errors, authentication expiry, inaccessible resources, connectivity failures, stale versions, query limits, and ambiguous mutation failures.

### FR-WEB-TEST-004: Accessibility Tests

Automated accessibility and keyboard-focused tests shall cover critical user journeys. Manual assistive-technology review should be included before release.

### FR-WEB-TEST-005: Responsive Tests

Critical workflows shall be verified at representative supported viewport sizes and input modes.

### FR-WEB-TEST-006: Security Tests

Tests shall cover untrusted content rendering, external links, credential leakage, signed-URL leakage, protected navigation, and the selected session-protection mechanism.

### FR-WEB-TEST-007: Two-User Isolation

End-to-end tests shall use at least two users and verify that graphopper-web does not present another user's private resources when graphopper-backend denies access.

## 23. Out of Scope for the Initial Version

Unless explicitly added later, the following are outside the initial graphopper-web scope:

- Offline operation or synchronization
- Shared or collaborative graph editing
- Public graph publishing
- Real-time multi-user updates
- Administrative browsing of user data
- Multiple templates within one graph
- Cross-graph relationships
- Bulk import or export
- Graph history restoration
- Automatic relationship inference
- AI-based entity extraction
- Native operating-system application packaging
- Browser-side access to backend persistence
- Reimplementation of backend authorization or persistence rules

## 24. Assumptions and Design Decisions

This specification assumes:

1. graphopper-backend remains authoritative for private graph data and business rules.
2. Each graph has one owner and one node template in the initial version.
3. Relationships are directed and remain within one graph.
4. Backend identifiers and cursors remain opaque.
5. Authenticated workflows require network access; offline synchronization is not included.
6. graphopper-web is independently deployable from graphopper-backend, even when both are served through one public origin.
7. Browser-side validation improves usability but never replaces backend validation.

The following topics are resolved by `DESIGN.md`. A change to one of these decisions shall update the design and affected requirements before implementation:

1. Programming language, web framework, package manager, and build tooling.
2. Browser authentication architecture, including redirect flow, session storage, renewal, sign-out, CSRF protection, and whether a backend-for-frontend is required.
3. Hosting model, backend URL discovery, trusted origins, and deployment configuration delivery.
4. Supported browser and operating-system matrix.
5. Routing, rendering, and deep-link deployment strategy.
6. API client and OpenAPI type-generation strategy.
7. Server-state caching, invalidation, form-state, and optimistic-update strategy.
8. Graph visualization and layout approach, accessible alternative, and rendering limits.
9. Component styling, theming, design-system, and iconography approach.
10. Initial localization, date/time display, number display, and time-zone policy.
11. Product analytics, error reporting, consent, and privacy policy, if any.
12. Measurable performance budgets and release browser-test matrix.
13. Whether installable Progressive Web App behavior is desired; offline synchronization remains separately out of scope.
