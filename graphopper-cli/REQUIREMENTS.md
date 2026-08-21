# graphopper-cli Functional Requirements

## 1. Purpose

graphopper-cli is the command-line client for graphopper-backend. It enables people and automation to authenticate, manage graph data, and inspect graph relationships without requiring a graphical frontend.

graphopper-cli shall use graphopper-backend's documented API and shall not access backend persistence directly.

## 2. Scope

The initial CLI shall support:

- Backend connection configuration
- User authentication and sign-out
- Graph management
- Node-template inspection and management
- Node management
- Relationship management
- Terminal-friendly graph inspection
- Human-readable and machine-readable output
- Filtering, sorting, pagination, and graph traversal where supported by graphopper-backend
- Photo or file upload where supported by a template field
- Safe interactive and non-interactive operation

## 3. Users and Operating Modes

### 3.1 Interactive User

An interactive user runs commands in a terminal and receives readable output, prompts, and confirmations.

### 3.2 Automation User

An automation user invokes commands from scripts or continuous-integration environments and requires predictable output, exit codes, and non-interactive behavior.

### 3.3 Operating Modes

The CLI shall support:

- Human-readable operation for interactive terminals
- Machine-readable operation for scripts
- Non-interactive operation without prompts when all required input and confirmations are explicitly supplied

## 4. Command-Line Conventions

### FR-CLI-CORE-001: Root Command

The application shall expose a root command named `graphopper` unless packaging constraints require a documented alternative.

### FR-CLI-CORE-002: Resource-Oriented Commands

Commands shall be organized by resource, including `graph`, `template`, `node`, and `relationship`.

### FR-CLI-CORE-003: Help

The root command and every subcommand shall provide contextual help describing its purpose, arguments, options, and examples.

### FR-CLI-CORE-004: Version

The CLI shall provide a command or option that prints its version.

### FR-CLI-CORE-005: Consistent Options

Options used across multiple commands, such as output format, backend URL, graph identifier, and confirmation bypass, shall use consistent names and meanings.

### FR-CLI-CORE-006: Standard Streams

Successful command data shall be written to standard output. Diagnostics, warnings, progress information, and errors shall be written to standard error.

### FR-CLI-CORE-007: No Unexpected Prompts

The CLI shall not prompt when standard input or standard output is not connected to an interactive terminal unless an explicitly interactive mode is requested.

### FR-CLI-CORE-008: Precedence

When a setting can come from a command-line option, environment variable, or configuration file, the CLI shall use this precedence order:

1. Command-line option
2. Environment variable
3. Selected configuration profile
4. Default value

## 5. Configuration

### FR-CLI-CONFIG-001: Backend URL

The CLI shall allow the user to configure the graphopper-backend base URL.

### FR-CLI-CONFIG-002: Per-Command Override

The user shall be able to override the configured backend URL for an individual command.

### FR-CLI-CONFIG-003: Environment Configuration

Automation shall be able to supply supported configuration through documented environment variables.

### FR-CLI-CONFIG-004: Configuration Profiles

The CLI should support named profiles so a user can work with multiple graphopper-backend environments without repeatedly changing settings.

### FR-CLI-CONFIG-005: Configuration Inspection

The CLI shall allow a user to inspect the effective non-secret configuration and identify the active profile.

### FR-CLI-CONFIG-006: Secret Redaction

Configuration inspection and diagnostic output shall redact authentication credentials and other secrets.

### FR-CLI-CONFIG-007: Connection Validation

The CLI should provide a command that checks whether the configured backend is reachable and compatible.

## 6. Authentication

### FR-CLI-AUTH-001: Sign-In

The CLI shall allow a user to authenticate with graphopper-backend using its supported authentication flow.

### FR-CLI-AUTH-002: Interactive Secret Input

When a password or other secret is entered interactively, the CLI shall not display the secret on the terminal.

### FR-CLI-AUTH-003: Credential Storage

Persisted credentials shall be stored using an operating-system credential store where available or another documented storage method with access restricted to the current user.

### FR-CLI-AUTH-004: External Credential

Automation shall be able to supply an authentication credential using a documented non-interactive mechanism.

### FR-CLI-AUTH-005: Credential Precedence

An explicitly supplied credential shall take precedence over a stored credential for the current command without silently overwriting the stored credential.

### FR-CLI-AUTH-006: Current User

The CLI shall provide a command that displays the identity of the currently authenticated user without exposing their credential.

### FR-CLI-AUTH-007: Sign-Out

The CLI shall provide a command that removes the locally stored credential and requests backend revocation when supported.

### FR-CLI-AUTH-008: Authentication Failure

When authentication fails, the CLI shall report an actionable error and return a non-zero exit code without displaying the rejected credential.

### FR-CLI-AUTH-009: No Credential Logging

Credentials shall not be printed in ordinary output, verbose output, error messages, or diagnostic logs.

## 7. Graph Management

### FR-CLI-GRAPH-001: Create Graph

The CLI shall allow an authenticated user to create a graph with a name and optional description.

### FR-CLI-GRAPH-002: Create Graph with Template

The CLI shall allow the user to define an initial node template during graph creation when supported by graphopper-backend.

### FR-CLI-GRAPH-003: List Graphs

The CLI shall allow an authenticated user to list the graphs they own.

### FR-CLI-GRAPH-004: Show Graph

The CLI shall allow an authenticated user to retrieve and display one of their graphs.

### FR-CLI-GRAPH-005: Update Graph

The CLI shall allow an authenticated user to update a graph's editable metadata.

### FR-CLI-GRAPH-006: Delete Graph

The CLI shall allow an authenticated user to delete a graph.

### FR-CLI-GRAPH-007: Delete Confirmation

Deleting a graph shall require interactive confirmation unless the user supplies an explicit confirmation-bypass option.

### FR-CLI-GRAPH-008: Complete Graph Retrieval

The CLI shall allow a user to retrieve a graph with its template, nodes, and relationships where supported by graphopper-backend.

## 8. Node Template Management

### FR-CLI-TEMPLATE-001: Show Template

The CLI shall allow a user to display the node template for a graph.

### FR-CLI-TEMPLATE-002: Add Field

The CLI shall allow a user to add a template field with a key, label, data type, required status, and supported optional properties.

### FR-CLI-TEMPLATE-003: Update Field

The CLI shall allow a user to update the editable properties of a template field.

### FR-CLI-TEMPLATE-004: Delete Field

The CLI shall allow a user to delete a template field.

### FR-CLI-TEMPLATE-005: Destructive Field Confirmation

Deleting a field and its values from existing nodes shall require explicit confirmation. The confirmation message shall state that the operation affects every node in the graph.

### FR-CLI-TEMPLATE-006: Impactful Template Changes

Before submitting a field type change, required-status change, or other change affecting existing values, the CLI shall explain the expected impact when that impact is available from graphopper-backend.

### FR-CLI-TEMPLATE-007: Field Ordering

The CLI shall allow a user to set or update a template field's display order where supported.

### FR-CLI-TEMPLATE-008: Backend Validation Errors

The CLI shall display field-specific backend validation errors, including failures caused by incompatible existing node values.

## 9. Node Management

### FR-CLI-NODE-001: Create Node

The CLI shall allow a user to create a node using values defined by the graph's node template.

### FR-CLI-NODE-002: Template-Aware Input

For interactive node creation, the CLI should retrieve the graph's template and prompt for template-defined values, clearly identifying required fields.

### FR-CLI-NODE-003: Non-Interactive Input

The CLI shall allow node values to be provided non-interactively through command options or a documented structured input format.

### FR-CLI-NODE-004: List Nodes

The CLI shall allow a user to list nodes in a graph.

### FR-CLI-NODE-005: Show Node

The CLI shall allow a user to display one node and its template-defined values.

### FR-CLI-NODE-006: Update Node

The CLI shall allow a user to update selected values on a node without requiring unchanged values to be resubmitted.

### FR-CLI-NODE-007: Clear Optional Value

The CLI shall provide an unambiguous way to clear an optional node value rather than leaving it unchanged.

### FR-CLI-NODE-008: Delete Node

The CLI shall allow a user to delete a node.

### FR-CLI-NODE-009: Delete Confirmation

Deleting a node shall require interactive confirmation. The confirmation shall warn that connected relationships will also be deleted.

### FR-CLI-NODE-010: Template Validation

The CLI should perform template-aware validation for usability, but graphopper-backend remains authoritative for all validation.

### FR-CLI-NODE-011: File Values

For image or file template fields, the CLI shall allow a user to supply a local file path or an external reference when supported by graphopper-backend.

### FR-CLI-NODE-012: Upload Failure

If a file upload fails, the CLI shall report whether node creation or update also failed or whether any partial result remains.

## 10. Relationship Management

### FR-CLI-REL-001: Create Relationship

The CLI shall allow a user to create a directed relationship between two nodes in the same graph.

### FR-CLI-REL-002: List Relationships

The CLI shall allow a user to list relationships in a graph.

### FR-CLI-REL-003: Filter Relationships

The CLI shall allow relationships to be filtered by source node, target node, or relationship type where supported by graphopper-backend.

### FR-CLI-REL-004: Show Relationship

The CLI shall allow a user to display a relationship.

### FR-CLI-REL-005: Update Relationship

The CLI shall allow a user to update a relationship's editable type or label.

### FR-CLI-REL-006: Delete Relationship

The CLI shall allow a user to delete a relationship.

### FR-CLI-REL-007: Delete Confirmation

Deleting a relationship shall require interactive confirmation unless the user supplies the explicit confirmation-bypass option.

## 11. Graph Inspection and Traversal

### FR-CLI-VIEW-001: Terminal Summary

The CLI shall provide a concise graph summary showing counts of template fields, nodes, and relationships.

### FR-CLI-VIEW-002: Connected Nodes

The CLI shall allow a user to retrieve nodes connected to a selected node where graphopper-backend supports traversal.

### FR-CLI-VIEW-003: Traversal Controls

Traversal commands should support relationship type, direction, and depth controls where supported by graphopper-backend.

### FR-CLI-VIEW-004: Textual Visualization

The CLI should provide a terminal-friendly representation of a graph or subgraph, subject to configured result limits.

### FR-CLI-VIEW-005: Large Graph Safeguard

The CLI shall avoid rendering an unbounded graph. It shall require or apply documented limits and explain when output has been truncated.

## 12. Querying and Pagination

### FR-CLI-QUERY-001: Filtering

The CLI shall expose backend-supported filters for graph resources using consistent option syntax.

### FR-CLI-QUERY-002: Sorting

The CLI should expose backend-supported sorting controls.

### FR-CLI-QUERY-003: Pagination

The CLI shall support paginated backend responses.

### FR-CLI-QUERY-004: Interactive Pagination

Human-readable list commands should make additional pages available without requiring users to understand backend cursor representations.

### FR-CLI-QUERY-005: Automation Pagination

Machine-readable operation shall expose sufficient pagination information for scripts to request subsequent pages.

### FR-CLI-QUERY-006: Fetch All

The CLI may provide an explicit option to fetch all pages. If provided, it shall document the potential time and data-volume impact.

## 13. Input and Output

### FR-CLI-IO-001: Human-Readable Output

The default output shall be readable in a terminal and should use concise tables or labeled fields as appropriate.

### FR-CLI-IO-002: JSON Output

The CLI shall support JSON output for successful commands that return data.

### FR-CLI-IO-003: Stable Machine Output

Machine-readable output shall contain only the requested result on standard output. Warnings and diagnostics shall not corrupt it.

### FR-CLI-IO-004: Structured Input

Commands that accept many values should support a documented structured input file or standard-input representation.

### FR-CLI-IO-005: Standard Input

Where structured input is supported, the CLI should allow input to be read from standard input using a documented marker.

### FR-CLI-IO-006: Character Encoding

The CLI shall support Unicode graph names, labels, template values, and relationship types.

### FR-CLI-IO-007: Identifier Fidelity

Resource identifiers shall be treated as opaque strings and shall not be modified or reformatted.

### FR-CLI-IO-008: Sensitive Values

The CLI shall avoid displaying fields designated as sensitive if graphopper-backend provides such metadata in the future, unless the user explicitly requests them.

## 14. Confirmation and Safety

### FR-CLI-SAFE-001: Destructive Confirmation

Graph deletion, node deletion, relationship deletion, and template-field deletion shall require confirmation in interactive mode.

### FR-CLI-SAFE-002: Explicit Bypass

The CLI shall provide a consistent explicit option, such as `--yes`, to bypass confirmation for automation.

### FR-CLI-SAFE-003: No Implicit Bypass

Non-interactive execution shall fail with an actionable error when confirmation is required but was not explicitly bypassed.

### FR-CLI-SAFE-004: Target Identification

A destructive confirmation shall identify the target resource and summarize known cascading effects.

### FR-CLI-SAFE-005: No Client-Side Assumption of Deletion

The CLI shall report deletion as successful only after graphopper-backend confirms it.

## 15. Errors and Exit Codes

### FR-CLI-ERR-001: Actionable Errors

Error messages shall identify the failed operation and provide actionable information without exposing secrets.

### FR-CLI-ERR-002: Backend Error Preservation

The CLI shall preserve graphopper-backend's machine-readable error code in JSON or other machine-readable error output.

### FR-CLI-ERR-003: Validation Errors

Validation failures shall identify the affected argument, option, template field, or node value where that information is available.

### FR-CLI-ERR-004: Network Errors

Connection failures, timeouts, and backend response failures shall be distinguishable from local input errors and authentication failures.

### FR-CLI-ERR-005: Non-Zero Failure Exit

Every failed command shall return a non-zero exit code.

### FR-CLI-ERR-006: Zero Success Exit

A successfully completed command shall return exit code zero.

### FR-CLI-ERR-007: Stable Exit Categories

The CLI shall document stable exit-code categories for at least usage errors, authentication or authorization failures, unavailable backend or network failures, validation failures, and unexpected errors.

### FR-CLI-ERR-008: Partial Results

If an operation returns partial results, the CLI shall clearly identify the result as partial and use a documented exit status appropriate to the operation.

## 16. Compatibility

### FR-CLI-COMPAT-001: Compatibility Detection

The CLI should detect when the configured graphopper-backend version or API version is incompatible.

### FR-CLI-COMPAT-002: Compatibility Error

When incompatibility prevents safe operation, the CLI shall stop and explain the supported version range or corrective action.

### FR-CLI-COMPAT-003: Forward-Compatible Responses

The CLI should tolerate additional response fields that do not change the meaning of fields it consumes.

## 17. Out of Scope for the Initial Version

Unless added later, the following are outside the initial CLI scope:

- Direct access to graphopper-backend's database or file storage
- A graphical or full-screen terminal user interface
- Offline graph editing or local synchronization
- Public graph publishing
- Multi-user collaboration workflows
- Administrative access to other users' data
- Automatic relationship inference
- AI-based entity extraction
- Bulk import and export beyond the structured input needed for individual commands
- Client-side plugins or scripting extensions
- Implementing backend business rules as an alternative to backend validation

## 18. Assumptions and Decisions Requiring Confirmation

This specification currently assumes that:

1. The installed root command will be named `graphopper`.
2. graphopper-backend will expose a documented, versioned API consumable by the CLI.
3. The backend authentication flow will support command-line clients.
4. JSON will be the initial machine-readable output format.
5. The exact configuration file format and location will be selected during implementation design.
6. The exact environment-variable names will be selected during implementation design.
7. The final exit-code values will be assigned during CLI interface design.
8. Operating-system credential storage will be preferred when available.
9. The CLI implementation language, framework, packaging format, and supported operating systems have not yet been selected.
10. Human-readable graph visualization will be intentionally bounded and will not replace future graphical clients.
