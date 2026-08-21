# graphopper-backend Functional Requirements

## 1. Purpose

graphopper-backend is the backend API service in the Graphopper monorepo. It provides multi-user storage and management of graph-structured data.

A graph may represent information such as:

- A family tree
- Relationships between persons of interest
- An organizational structure
- Any other collection of connected entities

graphopper-backend exposes API endpoints that clients, such as graphopper-cli, future web applications, and future mobile applications, can use to manage graphs, node templates, nodes, relationships, and node values.

## 2. Scope

The initial system shall support:

- User authentication
- Per-user data isolation
- Graph management
- Uniform node-template management within each graph
- Node management
- Relationship management
- Photo or file values on nodes
- Data retrieval suitable for graph visualization

## 3. Actors

### 3.1 Unauthenticated User

An unauthenticated user may:

- Register an account, if self-registration is enabled
- Sign in
- Request an authentication credential or token

An unauthenticated user shall not be permitted to access graph data.

### 3.2 Authenticated User

An authenticated user may:

- Manage their own graphs
- Manage the node template belonging to each of their graphs
- Manage nodes within their own graphs
- Manage relationships within their own graphs
- Retrieve only data that they own

## 4. Core Data Concepts

### 4.1 User

A user represents an authenticated owner of graphopper-backend data.

Each user shall have:

- A unique identifier
- Authentication information
- Account creation and update timestamps
- An account status, where applicable

### 4.2 Graph

A graph is a user-owned container for a node template, nodes, and relationships.

A graph shall have:

- A unique identifier
- An owner
- A name
- An optional description
- A creation timestamp
- A last-updated timestamp

### 4.3 Node Template

Each graph shall have one node template. The template defines the uniform set of fields available to every node in that graph.

Each template field shall have:

- A unique identifier
- A machine-readable key, such as `date_of_birth`
- A display label, such as `Date of Birth`
- A data type
- A required or optional designation
- An optional description
- An optional default value
- An optional display order
- Optional field-specific validation rules
- Creation and last-updated timestamps

Supported field data types should include:

- Text
- Long text
- Integer
- Decimal
- Boolean
- Date
- Date and time
- URL
- Image or file reference

A template field value may be null unless the field is required.

### 4.4 Node

A node represents an entity within a graph, such as a person, organization, place, or event.

A node shall have:

- A unique identifier
- A parent graph
- A set of values corresponding to the graph's node template
- A creation timestamp
- A last-updated timestamp

Every node in the same graph shall use the same node template. A node shall not define arbitrary fields outside that template.

For example, a family-tree graph might define this template:

| Field key | Display label | Type | Required |
| --- | --- | --- | --- |
| `name` | Name | Text | Yes |
| `date_of_birth` | Date of Birth | Date | No |
| `date_of_death` | Date of Death | Date | No |
| `photo` | Photo | Image | No |
| `notes` | Notes | Long text | No |

### 4.5 Relationship

A relationship connects two nodes in the same graph.

A relationship shall have:

- A unique identifier
- A parent graph
- A source node
- A target node
- A relationship type or label
- Creation and last-updated timestamps

Examples include:

- `PARENT_OF`
- `CHILD_OF`
- `SPOUSE_OF`
- `RELATED_TO`
- `KNOWS`
- `WORKS_WITH`
- `ASSOCIATED_WITH`

The system shall support directed relationships. A client may interpret a relationship as bidirectional when appropriate or create relationships in both directions.

### 4.6 Template Field and Node Value

A template field defines an attribute that is available on every node in a graph. A node value is the value assigned to that field on an individual node.

For example, `date_of_birth` is a template field and `1990-04-15` is the corresponding value for a particular node.

## 5. Authentication Requirements

### FR-AUTH-001: User Registration

The system shall allow a user to create an account when self-registration is enabled.

### FR-AUTH-002: User Sign-In

The system shall authenticate a user using the configured authentication method.

### FR-AUTH-003: Authentication Credential

After successful authentication, the system shall provide or recognize a credential that clients can include in subsequent API requests.

### FR-AUTH-004: Invalid Authentication

The system shall reject requests that contain missing, invalid, revoked, or expired authentication credentials when authentication is required.

### FR-AUTH-005: Sign-Out or Credential Revocation

The system shall allow a user to sign out or revoke an active credential when supported by the selected authentication mechanism.

### FR-AUTH-006: Current User

The system shall provide a way for an authenticated client to retrieve the current user's basic account information.

## 6. Authorization and Data Isolation

### FR-AUTHZ-001: Ownership Assignment

Every graph shall belong to exactly one user.

### FR-AUTHZ-002: Ownership Inheritance

Node templates, nodes, relationships, template fields, node values, and file associations shall be accessible only through the owner of their parent graph.

### FR-AUTHZ-003: Read Isolation

A user shall not be able to retrieve another user's graphs, node templates, nodes, relationships, template fields, node values, or files.

### FR-AUTHZ-004: Write Isolation

A user shall not be able to create, update, or delete data inside another user's graph.

### FR-AUTHZ-005: Identifier Protection

Possession or discovery of another user's resource identifier shall not grant access to that resource.

### FR-AUTHZ-006: Ownership Validation

The system shall verify resource ownership for every protected operation rather than relying on client-provided ownership information.

### FR-AUTHZ-007: Cross-Owner References

The system shall reject attempts to create relationships or references involving resources owned by different users.

## 7. Graph Management

### FR-GRAPH-001: Create Graph

An authenticated user shall be able to create a graph.

### FR-GRAPH-002: List Graphs

An authenticated user shall be able to list all graphs they own.

### FR-GRAPH-003: Retrieve Graph

An authenticated user shall be able to retrieve one of their graphs by its identifier.

### FR-GRAPH-004: Update Graph

An authenticated user shall be able to change the name, description, and other editable metadata of a graph they own.

### FR-GRAPH-005: Delete Graph

An authenticated user shall be able to delete a graph they own.

### FR-GRAPH-006: Graph Deletion Consequences

Deleting a graph shall also delete, or otherwise make inaccessible, its node template, template fields, nodes, node values, relationships, and file associations.

### FR-GRAPH-007: Retrieve Complete Graph

An authenticated user shall be able to retrieve a graph together with its node template, nodes, and relationships in a representation suitable for client-side visualization.

### FR-GRAPH-008: Empty Graphs

The system shall allow a graph to exist without any nodes or relationships.

### FR-GRAPH-009: Node Template Ownership

Each node template shall belong to exactly one graph.

### FR-GRAPH-010: Uniform Node Schema

All nodes within a graph shall conform to that graph's node template.

### FR-GRAPH-011: Independent Graph Templates

Different graphs owned by the same user may have different node templates.

### FR-GRAPH-012: Initial Template

When creating a graph, a user shall be able to define its initial node template as part of graph creation or create the graph with an empty template and configure it later.

A node shall not be created unless all required template fields can be satisfied.

## 8. Node Template Management

### FR-TEMPLATE-001: Retrieve Template

An authenticated user shall be able to retrieve the node template belonging to a graph they own.

### FR-TEMPLATE-002: Add Template Field

An authenticated user shall be able to add a field definition to the node template of a graph they own.

### FR-TEMPLATE-003: Update Template Field

An authenticated user shall be able to update a template field's editable properties, including its display label, description, required status, default value, display order, and validation rules.

### FR-TEMPLATE-004: Delete Template Field

An authenticated user shall be able to delete a field from the node template of a graph they own.

### FR-TEMPLATE-005: Unique Field Key

Each template field key shall be unique within its graph.

### FR-TEMPLATE-006: Field Key Validation

A field key shall:

- Not be empty
- Use a documented naming format
- Not conflict with system-reserved field names
- Be unique within its graph

### FR-TEMPLATE-007: Field Type Validation

A template field's default value and all corresponding node values shall conform to the field's declared data type.

### FR-TEMPLATE-008: Required Fields

A field may be marked as required. Every node shall have a valid, non-null value for each required field.

### FR-TEMPLATE-009: Optional Fields

A node may omit a value or store a null value for a field that is not required.

### FR-TEMPLATE-010: Field Ordering

The template shall allow fields to be assigned a display order for use by clients.

### FR-TEMPLATE-011: Rename Display Label

Changing a field's display label shall not affect existing node values.

### FR-TEMPLATE-012: Field Key Changes

A template field shall have a stable internal identifier. If its machine-readable key is editable, changing the key shall preserve the field's identity and all existing node values.

### FR-TEMPLATE-013: Add Optional Field to Populated Graph

When an optional field is added to a graph containing existing nodes, those nodes shall initially receive either a null value or the field's default value.

### FR-TEMPLATE-014: Add Required Field to Populated Graph

A required field shall not be added to a graph containing existing nodes unless a valid default value is supplied or a valid value is supplied for every existing node as part of the operation.

### FR-TEMPLATE-015: Delete Field Consequences

Deleting a template field shall also delete its value from every node in the graph.

Because this operation can cause data loss, the API shall require an explicit confirmation indicator or an equivalent documented safeguard.

### FR-TEMPLATE-016: Change Field Data Type

The system shall allow a field's data type to change only when every existing value can be converted to or validated against the new type.

If any existing value is incompatible, the entire operation shall fail without changing the template or stored values.

### FR-TEMPLATE-017: Make Field Required

An optional field shall not be changed to required while any existing node has a missing, null, or invalid value for that field.

### FR-TEMPLATE-018: Make Field Optional

A required field may be changed to optional without changing existing node values.

### FR-TEMPLATE-019: Template Deletion

The node template shall not be deleted independently from its graph. Its individual fields may be added, updated, or deleted.

### FR-TEMPLATE-020: Template Isolation

A user shall not be able to retrieve or modify the node template of another user's graph.

## 9. Node Management

### FR-NODE-001: Create Node

An authenticated user shall be able to create a node in a graph they own by supplying values for fields defined in that graph's node template.

### FR-NODE-002: List Nodes

An authenticated user shall be able to list nodes belonging to one of their graphs.

### FR-NODE-003: Retrieve Node

An authenticated user shall be able to retrieve a node together with its template-defined values when they own its parent graph.

### FR-NODE-004: Update Node

An authenticated user shall be able to update the template-defined values of a node.

### FR-NODE-005: Delete Node

An authenticated user shall be able to delete a node from one of their graphs.

### FR-NODE-006: Node Deletion Consequences

Deleting a node shall remove its values and all relationships connected to it.

### FR-NODE-007: Template Conformance

The system shall reject a node value whose field is not defined in the graph's node template.

### FR-NODE-008: Required Value Validation

The system shall reject node creation or update when a required template field has no valid value. For a partial update, required fields not included in the request shall retain their existing values.

### FR-NODE-009: Value Type Validation

The system shall reject a node value that does not conform to its template field's data type or validation rules.

### FR-NODE-010: Default Values

When a node is created without a value for an optional field that has a default value, the system shall apply that default value.

### FR-NODE-011: Null and Missing Values

For optional fields, the API shall document whether a missing field and an explicit null value are stored differently or normalized to the same state.

### FR-NODE-012: Complete Node Representation

When returning a node, the API shall make it possible for clients to associate every node value with its template field definition.

### FR-NODE-013: Node Graph Membership

A node shall belong to exactly one graph and use only that graph's node template.

### FR-NODE-014: Move Restrictions

The system shall not move a node to another graph through an ordinary node update. If moving or copying is supported later, it shall be exposed as an explicit operation that validates the destination template.

## 10. Relationship Management

### FR-REL-001: Create Relationship

An authenticated user shall be able to create a relationship between two nodes in a graph they own.

### FR-REL-002: List Relationships

An authenticated user shall be able to list relationships belonging to one of their graphs.

### FR-REL-003: Retrieve Relationship

An authenticated user shall be able to retrieve a relationship by its identifier when they own its parent graph.

### FR-REL-004: Update Relationship

An authenticated user shall be able to update a relationship's type or label.

### FR-REL-005: Delete Relationship

An authenticated user shall be able to delete a relationship from one of their graphs.

### FR-REL-006: Same-Graph Validation

The source and target nodes of a relationship shall belong to the same graph as the relationship.

### FR-REL-007: Self-Referencing Relationship

The system may permit a node to have a relationship with itself unless a future graph rule prohibits it.

### FR-REL-008: Duplicate Relationships

The system shall allow multiple relationships between the same pair of nodes when the relationships have different meanings or identifiers.

## 11. Photo and File Handling

### FR-FILE-001: Photo Field

The system shall allow an image or file-reference field to be defined in a graph's node template.

### FR-FILE-002: File Upload or External Reference

The system shall support a documented method for assigning a photo or file value to a node, either by uploading a file to graphopper-backend-managed storage or by storing a reference to an externally hosted file.

### FR-FILE-003: File Authorization

A user shall not be able to access a privately stored file associated with another user's data.

### FR-FILE-004: File Validation

For graphopper-backend-managed uploads, the system shall validate supported file types and configured file-size limits.

### FR-FILE-005: File Replacement

An authenticated user shall be able to replace a node's photo or file value when permitted by the template.

### FR-FILE-006: File Removal

An authenticated user shall be able to remove an optional photo or file value from a node.

### FR-FILE-007: Orphaned Files

When a file value, template field, node, or graph is deleted, the system shall remove or otherwise manage any graphopper-backend-managed file that is no longer referenced.

## 12. Retrieval, Filtering, and Pagination

### FR-QUERY-001: Pagination

List operations shall support pagination so clients do not need to retrieve an unbounded number of resources in one request.

### FR-QUERY-002: Stable Result Structure

Paginated responses shall include the returned resources and sufficient pagination metadata or cursors to retrieve additional results.

### FR-QUERY-003: Filtering Nodes

Clients should be able to filter nodes by selected template-field values.

### FR-QUERY-004: Searching Nodes

Clients should be able to search nodes by supported textual template fields, such as a `name` field.

### FR-QUERY-005: Filtering Relationships

Clients should be able to filter relationships by source node, target node, or relationship type.

### FR-QUERY-006: Sorting

List operations should support sorting by supported system fields or template-field values.

### FR-QUERY-007: Graph Traversal

The system should allow a client to retrieve nodes connected to a given node, optionally limited by relationship type, direction, and traversal depth.

## 13. Validation and Business Rules

### FR-VAL-001: Required Values

The system shall reject an operation when a required value is missing.

### FR-VAL-002: Identifier Validation

The system shall reject malformed resource identifiers.

### FR-VAL-003: Template-Based Validation

Node values shall be validated against the current node template before they are stored.

### FR-VAL-004: Date Validation

Date and date-time values shall conform to the API's documented formats.

### FR-VAL-005: Cross-Field Validation

The template should support cross-field validation rules where necessary. For example, a family-tree template may specify that `date_of_death` cannot be earlier than `date_of_birth`.

### FR-VAL-006: Reference Validation

The system shall reject relationships or other references to resources that do not exist or are not accessible to the current user.

### FR-VAL-007: Atomic Node Operations

A node operation that fails validation shall not leave the node partially updated.

### FR-VAL-008: Atomic Template Changes

A template change affecting existing nodes shall be atomic. If any migration or validation fails, neither the template nor existing node values shall be partially changed.

### FR-VAL-009: Immutable System Fields

Clients shall not be able to modify system-managed fields such as resource identifiers, ownership, and creation timestamps through ordinary update operations.

## 14. API Behaviour

### FR-API-001: Client Independence

The API shall not depend on a particular frontend technology or user interface.

### FR-API-002: Machine-Readable Format

Requests and responses shall use a documented machine-readable representation, such as JSON, except for file-transfer operations where another content type is appropriate.

### FR-API-003: Consistent Resource Identifiers

Created resources shall receive unique identifiers that clients can use in later operations.

### FR-API-004: Creation Response

A successful creation operation shall return the created resource or sufficient information to retrieve it.

### FR-API-005: Update Response

A successful update operation shall return the updated resource or clearly indicate successful completion.

### FR-API-006: Delete Response

A successful delete operation shall clearly indicate that the resource was deleted.

### FR-API-007: Error Response

Failed operations shall return a consistent error structure containing:

- A machine-readable error code
- A human-readable message
- Relevant validation details, where appropriate
- A request or correlation identifier, where available

### FR-API-008: Missing or Inaccessible Resources

The system shall return an appropriate result when a requested resource does not exist or is not accessible to the current user. The implementation should avoid revealing the existence of another user's private resource.

### FR-API-009: Partial Updates

The API should support partial updates so clients can change selected fields without resubmitting the entire resource.

### FR-API-010: Idempotent Deletion

Repeated deletion requests should produce predictable behavior and shall not recreate or corrupt data.

## 15. Audit Information

### FR-AUDIT-001: Creation Timestamps

The system shall record when graphs, templates, template fields, nodes, and relationships are created.

### FR-AUDIT-002: Update Timestamps

The system shall record when graphs, templates, template fields, nodes, and relationships are last updated.

### FR-AUDIT-003: Acting User

Where audit history is implemented, the system shall associate changes with the authenticated user who performed them.

### FR-AUDIT-004: Change History

The system may retain a history of changes to graphs, templates, template fields, nodes, node values, and relationships for future auditing or restoration capabilities.

## 16. Deletion Policy

The initial implementation shall select and document one of the following approaches:

- **Hard deletion:** The resource and its dependent data are permanently removed.
- **Soft deletion:** The resource is marked as deleted and excluded from ordinary retrieval.

Regardless of the selected approach:

- Deleted resources shall no longer be returned by ordinary retrieval operations.
- Deleted resources shall not be usable in new relationships.
- Dependent relationships shall not remain active after a node is deleted.
- Deleting one user's resources shall not affect another user's data.
- Deleting a template field shall make its corresponding values unavailable on every node in that graph.

## 17. Out of Scope for the Initial Version

Unless added later, the following capabilities are outside the initial scope:

- Sharing graphs with other users
- Collaborative graph editing
- Publicly accessible graphs
- Role-based permissions within a graph
- Multiple node templates within one graph
- Per-node fields outside the graph's node template
- Templates shared between graphs
- Relationship templates or custom relationship attributes
- Graph version restoration
- Bulk import and export
- Real-time update notifications
- Automatic inference of relationships
- AI-based entity or relationship extraction
- Merging duplicate nodes
- Cross-graph relationships
- Administrative access to user data

## 18. Assumptions and Decisions Requiring Confirmation

This specification currently assumes that:

1. Each graph has exactly one node template.
2. All nodes in a graph use the same template.
3. Different graphs may have different templates.
4. Individual nodes store values but cannot introduce new fields.
5. Relationships are directed by default.
6. Nodes and relationships cannot span multiple graphs.
7. Each graph has exactly one owner.
8. Graph sharing is not required in the initial version.
9. Adding, deleting, or changing a template field may affect every node in the graph.
10. Deleting a node also deletes its connected relationships.
11. Relationship attributes and relationship templates are not required in the initial version.
12. Photos may be uploaded or stored as external references; the final storage approach is not yet selected.
13. The exact API protocol, authentication technology, storage engine, and deployment architecture will be specified separately.
14. The implementation must decide whether template field keys are editable or immutable.
15. The implementation must decide whether missing optional values and explicit null values are stored differently.
16. The implementation must select and document a hard-deletion or soft-deletion strategy.
