# IAM: roles, groups, resources and permissions

The access model. **Resources** declare what can be protected and their actions; each action is a **permission** (`<resource>:<action>`). **Roles** bundle permissions. Users receive roles directly or through **groups**. The backend checks permissions with `requirePermission(...)` on each route; the frontend hides what the user cannot use.

```
User ──(direct assignment)──▶ Role ──▶ Permission ◀── Resource action
  └──▶ Group ──(group role)──▶ Role
```

## Code

| Layer                             | Path                                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roles                             | `apps/backend/src/modules/roles/`                                                                                                                                         |
| Groups                            | `apps/backend/src/modules/groups/`                                                                                                                                        |
| Resources                         | `apps/backend/src/modules/resources/`                                                                                                                                     |
| Permission catalog and assignment | `apps/backend/src/modules/permission/` (`permission-catalog.*` for IAM, `permission.*` for the older list/assign API)                                                     |
| Enforcement                       | `apps/backend/src/services/auth/permission.service.ts`, `src/middleware/auth.ts`                                                                                          |
| Second engine (unwired)           | none: `apps/backend/src/rbac/` and `/api/v1/rbac` were deleted on 2026-10-16 (M1)                                                                                    |
| Frontend                          | `features/iam/roles/` (list, detail, `permission-matrix`), `features/iam/groups/`, `features/iam/resources/`, `features/iam/permissions/` (catalog, detail, usage drawer) |
| Frontend RBAC                     | `core/rbac/` (`PermissionService`, `policy.store.ts`, `*hasPermission` directive, policy-version interceptor), `core/auth/auth.guard.ts` (`canMatchPermission`)           |

## How a permission check works

1. `authenticate` puts `userId` and `tenantId` on the request.
2. `requirePermission('users:read', 'users:manage')` calls `PermissionService.loadForUser(userId, tenantId)` once per request. It collects the permission rows of every **ACTIVE, non-deleted** role the user holds, from two sources: direct `user_role_assignments` in that organization, and roles granted to the user's **ACTIVE groups** (`user_groups` → `group_roles`). A role belongs to the organization or is global (no organization). The result is cached for 30 seconds under `iam:perms:{org}:{user}` and dropped by `PermissionService.invalidate()` whenever a role, group, group role, role permission, menu grant or assignment changes.
3. A `deny` row on any of those roles removes the permission whatever other roles allow. `PermissionService.has(set, code)` checks the denies first, then the grants.
4. Both lists match on an exact code or a wildcard: `*:*` (owner), `resource:*` (any depth, e.g. `system:*` covers `system:audit:read`), or `*:action`. So `deny users:manage` beats an Owner's `*:*`.
5. The old fallback ("no assignment → the role whose name matches `users.role`") is **off**. Set `PERMISSION_ROLE_NAME_FALLBACK=true` to turn it back on; prefer explicit assignments. Migration `20261016000000_p0_security_permissions` created an explicit assignment for every member who depended on it.
6. The User Request access preview (`user-requests/user-request.access.ts`) uses the same eligibility rules (active roles and groups, deny wins), so approvers see the access the user will actually get.

The frontend gets the same keys from `GET /auth/me` and stores them in `policy.store.ts`; `canMatchPermission(code)` and `*hasPermission` read that store. The `/api/v1/rbac` gateway no longer exists.

## Permission keys in use

| Area                  | Keys                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Users and requests    | `users:read`, `users:manage`, `user-requests:read`, `:create`, `:update`, `:submit`, `:approve`, `:reject`, `:send-back`, `:cancel`, `:retry`, `:notes:create`, `:audit:read` |
| Access control        | `roles:read`, `roles:manage`, `groups:read`, `groups:manage`, `resources:read`, `resources:manage`                                                                            |
| Security and settings | `settings:manage`, `settings:write`, `sessions:view`, `sessions:revoke`                                                                                                       |
| Operations            | `AUDIT_LOG_VIEW`, `AUDIT_LOG_EXPORT`, `system:audit:read`, `system:audit:export`, `OPERATIONS_SYSTEM_HEALTH_VIEW`, `system:rbac:read`                                         |
| Content               | `cms:read`, `cms:manage`, `blog:read`, `blog:manage`, `themes:read`, `themes:manage`, `media:upload` (`media:create` legacy), `media:delete`                                  |
| Insights              | `dashboard:read`, `analytics:read`, `analytics:export`                                                                                                                        |
| Projects              | `projects:create`, `projects:write`, `projects:delete`                                                                                                                        |
| Timesheets            | `timesheet:approve` (also the reviewer key for daily and monthly sheets)                                                                                                      |

## API

All routes need `authenticate` plus the listed permission.

**Roles** `/api/v1/iam/roles`

| Method | Path                                              | Permission     | Purpose                                                                                |
| ------ | ------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------- |
| GET    | `/`, `/all`, `/stats`, `/:id`, `/:id/permissions` | `roles:read`   | Search, picker list, counts, detail, permission matrix                                 |
| POST   | `/`                                               | `roles:manage` | Create (key generated from name, unique)                                               |
| PATCH  | `/:id`                                            | `roles:manage` | Update                                                                                 |
| DELETE | `/:id`                                            | `roles:manage` | Soft delete; removes its permissions, user and group assignments; system roles refused |
| PUT    | `/:id/permissions`                                | `roles:manage` | Set the matrix (`replace` or `merge`)                                                  |
| POST   | `/:id/copy`                                       | `roles:manage` | Duplicate                                                                              |

**Groups** `/api/v1/iam/groups`

| Method              | Path                                   | Permission      |
| ------------------- | -------------------------------------- | --------------- |
| GET                 | `/`, `/tree`, `/stats`, `/:id`         | `groups:read`   |
| POST, PATCH, DELETE | `/`, `/:id`                            | `groups:manage` |
| POST / DELETE       | `/:id/members`, `/:id/members/:userId` | `groups:manage` |
| PUT                 | `/:id/roles`                           | `groups:manage` |

**Resources** `/api/v1/iam/resources`

| Method              | Path                                     | Permission                                              |
| ------------------- | ---------------------------------------- | ------------------------------------------------------- |
| GET                 | `/`, `/tree`, `/key/:key`, `/:id`        | `resources:read`                                        |
| POST, PATCH, DELETE | `/`, `/:id`                              | `resources:manage`                                      |
| POST / DELETE       | `/:id/actions`, `/:id/actions/:actionId` | `resources:manage` (keeps the permission table in sync) |

**Permission catalog** `/api/v1/iam/permissions`: GET `/`, `/groups`, `/:id` need `roles:read`; POST `/`, `/groups`, PUT/DELETE `/:id` need `roles:manage`.

**Older permission API** `/api/v1/permissions`: GET `/` (signed in), POST `/` and `/assign` (`roles:manage`).

## Data model

`Role` (key, scope `RoleScope`, status `EntityStatus`, `isSystem`, optional `organizationId`), `Permission`, `PermissionGroup`, `RolePermission` (effect `allow`/`deny`, per organization), `UserRoleAssignment`, `Group` (`GroupType`, tree), `UserGroup`, `GroupRole`, `Resource` (`ResourceType`, tree, version), `ResourceAction`.

## Frontend

| Route                                      | Permission       | Screen                                                             |
| ------------------------------------------ | ---------------- | ------------------------------------------------------------------ |
| `/iam/roles`, `/iam/roles/:id`             | `roles:read`     | Role search; detail with permission matrix, groups, users, history |
| `/iam/groups`, `/iam/groups/:id`           | `groups:read`    | Group tree/list; detail with members and roles                     |
| `/iam/resources`, `/iam/resources/:id`     | `resources:read` | Resource tree; actions                                             |
| `/iam/permissions`, `/iam/permissions/:id` | `roles:read`     | Catalog; "where used" drawer                                       |

## Tests

`roles/role.service.spec.ts`, `groups/group.service.spec.ts`, `permission/permission-catalog.service.spec.ts`, `services/auth/permission.service.spec.ts` (role status, group roles, deny, fallback flag, cache). No tests for `resources`.

## Review notes

- Enforcement honours role status, deny rules and group roles (review **H6**, fixed 2026-10-16).
- Roles, groups and resources are platform-wide, not per organization (role filter is optional). Decide whether tenant admins should manage them (related to **H5**).
- The legacy `/api/v1/admin/roles|groups|resources` routes duplicate these modules without permission checks (**C2**).

## Related

[ROLES_MODULE.md](../ROLES_MODULE.md), [ADMIN_MODULE_SETUP.md](../ADMIN_MODULE_SETUP.md), [IAM users](iam-users.md)
