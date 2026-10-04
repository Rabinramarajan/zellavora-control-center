# Legacy admin API and screens

The administration API that predates the IAM modules. It mimics an older "search / open / save / delete" contract (including the original mixed-case paths such as `/Branch/Branch/save` and `/MAsterConfig/...`), talks to Supabase with the service-role key, and maps UUIDs to numeric serial ids in memory. **It is superseded by the IAM modules and should be removed.**

## Code

| Layer                 | Path                                                                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend               | `apps/backend/src/routes/admin-users.ts`, `admin-roles.ts`, `admin-groups.ts`, `admin-resources.ts`, `admin-configs.ts` (regions, branches, configurations), `admin-audit.ts`, `admin-helpers.ts` (serial maps, response wrapper, mock branches) |
| Frontend still on it  | `features/admin/components/resources/resource-manager/` via `features/admin/services/admin-api.service.ts` and `admin-store.service.ts`; `core/api/audit.api.ts` (`/admin/audit`)                                                                |
| Frontend path mapping | `core/http/api-base-url.interceptor.ts` rewrites `/api/user`, `/role`, `/resource`, `/Branch`, `/MAsterConfig`, `/auditlog`, `/config`, `/group` to `/api/v1/admin/...`                                                                          |

## Endpoints

All under `/api/v1/admin`, every one guarded by `authenticate` only (no permission check, no organization filter). Each has a readable path and its historical alias.

| Area                             | Paths (readable · historical)                                                                                                                                                                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Users                            | `GET /users/metadata` · `/user/initialize`; `GET`/`POST /users/search` · `/user/search`; `GET /users/template` · `/user/new`; `POST /users/details` · `/user/open`; `POST /users/save` · `/user/save`; `GET /users/assignable-roles`; `POST /users/team-members/search`; `POST /users/branch-options` |
| Roles                            | `GET /roles/metadata`; `GET`/`POST /roles/search`; `GET /roles/template`; `POST /roles/details`, `/roles/save`, `/roles/delete`; `POST /roles/resource-mappings/details`, `/roles/resource-mappings/save`                                                                                             |
| Groups                           | `GET`/`POST /groups/search`; `POST /groups/details`, `/groups/save`, `/groups/delete`                                                                                                                                                                                                                 |
| Resources                        | `GET /resources/metadata`, `/resources/template`; `GET`/`POST /resources/search`; `POST /resources/details`, `/resources/save`, `/resources/delete`, `/resources/bulk-save`                                                                                                                           |
| Branches, regions, configuration | `GET /regions/metadata`; `/branches/template`, `/branches/search`, `/branches/details`, `/branches/save`, `/branches/delete`; `/configurations/search`, `/configurations/details`, `/configurations/save`, `/configurations/list`, `/configurations/delete`                                           |
| Audit                            | `GET`/`POST /audit-logs/search`; `POST /audit-logs/details`; `GET /audit`, `/audit/export`                                                                                                                                                                                                            |

## Screens

| Route                                                                                      | Status                                                                                |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `/admin/users`, `/admin/users/new`, `/admin/users/:id`, `/admin/roles`, `/admin/roles/:id` | Redirect to the IAM equivalents                                                       |
| `/admin/resources`                                                                         | Resource manager, still on the legacy API                                             |
| `/admin/branches`                                                                          | Branch manager, already on the IAM API (also mounted at `/iam/organization/branches`) |
| `/users`                                                                                   | Separate users page (`features/users`) on the IAM API; duplicates `/iam/users`        |

## Replacement map

| Legacy                                 | Use instead                                                          |
| -------------------------------------- | -------------------------------------------------------------------- |
| `/admin/users/*`                       | `/api/v1/iam/users` (read) and `/api/v1/iam/user-requests` (changes) |
| `/admin/roles/*`                       | `/api/v1/iam/roles`                                                  |
| `/admin/groups/*`                      | `/api/v1/iam/groups`                                                 |
| `/admin/resources/*`                   | `/api/v1/iam/resources`                                              |
| `/admin/branches/*`                    | `/api/v1/branches`                                                   |
| `/admin/configurations/*`              | `/api/v1/iam/configurations`                                         |
| `/admin/audit*`, `/admin/audit-logs/*` | `/api/v1/operations/audit-logs`                                      |

## Tests

`features/admin/services/admin-api.service.spec.ts`, `admin-store.service.spec.ts` (frontend only). No backend tests.

## Review notes

- **Any signed-in user can create or modify users, roles, groups, resources, branches and configuration** through these routes, bypassing the User Request approval workflow (review **C2**). The audit read skips `AUDIT_LOG_VIEW` (**H4**).
- In-memory serial maps break across serverless instances (**M8**).
- Removal steps: move the resource manager to `IamAdminApiService`; switch `audit.api.ts` to the operations API; delete the interceptor's legacy mappings; unmount the six routers in `routes/index.ts`; delete the files and `features/admin/services`.
