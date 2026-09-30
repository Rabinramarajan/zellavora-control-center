# IAM Roles

Roles are the central RBAC layer for ZCC:

```
User -> Group -> Role -> Permission -> Resource + Scope
```

Role Search is for finding and managing roles. Role Detail is for understanding exactly who receives a role and what access it grants.

## Routes

| UI route             | Purpose                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/iam/roles`         | Search roles by name/code, status, type, resource, permission, group, scope, creator and date ranges              |
| `/iam/roles/new`     | Create role wizard: basic details, scope, resources and permissions, assignments, review                          |
| `/iam/roles/:roleId` | Detail page with overview, permissions, resources, groups, users, scope, change history, status history and audit |

## Statuses

Default statuses:

| Status     | Meaning                                               |
| ---------- | ----------------------------------------------------- |
| `DRAFT`    | Role is being prepared and should not grant access    |
| `ACTIVE`   | Role grants access through direct or group assignment |
| `INACTIVE` | Role is disabled and should not grant access          |

If role approval is enabled, add `PENDING_APPROVAL` and `REJECTED`. Do not use `DELETED` as a normal business status; prefer archive or soft delete internally.

## Search

Compact search fields:

| Field            | Type         | Behavior                    |
| ---------------- | ------------ | --------------------------- |
| Role Name / Code | Text         | Partial/exact search        |
| Status           | Multi-select | Active, Inactive            |
| Type             | Multi-select | System, Custom              |
| Resource         | Multi-select | Users, Projects, Blog, etc. |

More filters:

| Field             | Type         | Behavior                                              |
| ----------------- | ------------ | ----------------------------------------------------- |
| Permission        | Multi-select | Read, Create, Update, Delete, Approve, Manage         |
| Group             | Multi-select | Roles assigned to a group                             |
| Scope             | Multi-select | Global, Branch, Department, Team, Own Records, Custom |
| Created By        | User search  | Creator                                               |
| Created From / To | Date         | Creation date range                                   |
| Updated From / To | Date         | Update date range                                     |

Results should show Role Name, Role Code, Type, Scope, Permission count, Group count, Effective User count, Status, Last Updated and Actions.

## Detail

Header fields:

| Field                |
| -------------------- |
| Role Name            |
| Role Code            |
| Role Type            |
| Scope                |
| Status               |
| Permission count     |
| Group count          |
| Effective user count |

Sections:

| Section        | Purpose                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| Overview       | Role ID, name, code, description, type, status, created/updated metadata |
| Permissions    | Resource-grouped permission matrix                                       |
| Resources      | Resources attached to the role with permission counts                    |
| Groups         | Groups that receive the role                                             |
| Users          | Direct and inherited users, with source                                  |
| Scope          | Where permissions apply                                                  |
| Change History | Approval/request records for role changes                                |
| Status History | Created, activated, updated and deactivated timeline                     |
| Audit          | Read-only security audit                                                 |

## Permission Matrix

Permissions should stay backend-friendly:

```
users:read
users:create
users:update
users:disable
users:manage
user-requests:read
user-requests:create
user-requests:approve
roles:read
roles:manage
groups:read
groups:manage
system:audit:read
```

Group permissions by resource instead of showing a giant flat list. Allow Select All within a resource, but avoid one unrestricted global Select All. Privileged permissions such as `roles:manage`, `permissions:manage`, `users:security:manage` and `system:config:manage` should require confirmation before save.

## Assignments

Role users must distinguish direct access from inherited access.

| Assignment           | Behavior                                            |
| -------------------- | --------------------------------------------------- |
| Direct               | Can be removed from Role Detail                     |
| Inherited from Group | Show source group; removal must happen on the group |

Effective user count should deduplicate users who receive the role through multiple groups.

## Protected Roles

System roles such as Owner, Super Admin, IAM Admin, IAM Viewer and Standard User should be clearly marked as `SYSTEM`.

Protected roles should prevent unsafe actions such as hard delete, role code rename and unrestricted permission modification. Owner or `all:all` access must remain highly restricted.

## Deactivation

Do not immediately delete roles.

```
Deactivate Role
-> Check Impact
-> Show affected groups and effective users
-> Require Reason
-> Confirm
-> Deactivate
-> Recalculate Effective Access
-> Audit
```

Backend policy should block deactivation if it would leave users without required baseline access.

## Clone

Clone should copy resources, permissions and scope configuration by default. It should not copy users or groups by default, to avoid accidental mass access assignment.

## Audit

Capture Role Created, Role Updated, Role Activated, Role Deactivated, Permission Added, Permission Removed, Resource Added, Resource Removed, Group Assigned, Group Removed, User Assigned, User Removed, Scope Changed and Role Cloned.

Audit fields: timestamp, actor, action, role, related resource, before value, after value, reason, result and correlation ID.
