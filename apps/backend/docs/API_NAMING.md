# API naming conventions

Use the canonical URLs below for new integrations. Existing URLs remain aliases to the same routers and handlers, with the same HTTP methods, payloads, middleware, and response contracts. No redirect or client-side URL rewriting is required.

## Conventions

- Application URLs start with `/api/v1`.
- Use lowercase, kebab-case path segments and plural names for resource collections.
- Use domain names, not implementation labels such as `clean`, or UI abbreviations such as `DDL`.
- Use nested resource paths for relationships. Existing command endpoints retain explicit action names and HTTP methods where their payload contracts require them.
- Use camelCase path parameter names, such as `{userId}`.
- Group Swagger operations by business domain, with readable sentence-case summaries.
- Assign a unique camelCase operation ID to every method/path pair. Preserve these IDs unless deliberately changing the API contract.
- Document canonical paths only. Maintain historical aliases during migration; removing them requires a separate compatibility decision.

## Distinct contracts

`/auth` is the existing session and tenant authentication API. `/identity/auth` is the organization identity service previously exposed under `/clean/auth`. They are separate implementations and must not be mounted over one another.

`/settings` serves application settings by section. `/organization-settings` serves organization settings by key. The `/admin`, `/iam`, and `/rbac` domains likewise retain their distinct data and authorization contracts.

## Namespace migration

| Historical prefix             | Canonical prefix                |
| ----------------------------- | ------------------------------- |
| `/api/v1/auth/register`       | `/api/v1/auth/registrations`    |
| `/api/v1/register`            | `/api/v1/registrations`         |
| `/api/v1/clean/auth`          | `/api/v1/identity/auth`         |
| `/api/v1/clean/invitations`   | `/api/v1/invitations`           |
| `/api/v1/clean/organizations` | `/api/v1/organizations`         |
| `/api/v1/clean/branches`      | `/api/v1/branches`              |
| `/api/v1/clean/permissions`   | `/api/v1/permissions`           |
| `/api/v1/clean/settings`      | `/api/v1/organization-settings` |
| `/api/v1/clean/notifications` | `/api/v1/notifications`         |
| `/api/v1/clean/verifications` | `/api/v1/verifications`         |
| `/api/v1/clean/audits`        | `/api/v1/audit-logs`            |
| `/api/v1/clean/storage`       | `/api/v1/storage`               |
| `/api/v1/clean/ddls`          | `/api/v1/lookups`               |

## Endpoint migration

Both namespace aliases and relative-path aliases are supported. New callers should use the complete canonical URL shown here.

| Method | Historical URL                                                  | Canonical URL                                          |
| ------ | --------------------------------------------------------------- | ------------------------------------------------------ |
| GET    | `/api/v1/admin/user/initialize`                                 | `/api/v1/admin/users/metadata`                         |
| GET    | `/api/v1/admin/user/search`                                     | `/api/v1/admin/users/search`                           |
| POST   | `/api/v1/admin/user/search`                                     | `/api/v1/admin/users/search`                           |
| GET    | `/api/v1/admin/user/new`                                        | `/api/v1/admin/users/template`                         |
| POST   | `/api/v1/admin/user/open`                                       | `/api/v1/admin/users/details`                          |
| POST   | `/api/v1/admin/user/save`                                       | `/api/v1/admin/users/save`                             |
| GET    | `/api/v1/admin/user/role/get`                                   | `/api/v1/admin/users/assignable-roles`                 |
| POST   | `/api/v1/admin/user/team/user/get`                              | `/api/v1/admin/users/team-members/search`              |
| POST   | `/api/v1/admin/user/LoadBranchDDLByUserLoginId`                 | `/api/v1/admin/users/branch-options`                   |
| GET    | `/api/v1/admin/role/initialize`                                 | `/api/v1/admin/roles/metadata`                         |
| GET    | `/api/v1/admin/role/search`                                     | `/api/v1/admin/roles/search`                           |
| POST   | `/api/v1/admin/role/search`                                     | `/api/v1/admin/roles/search`                           |
| GET    | `/api/v1/admin/role/new`                                        | `/api/v1/admin/roles/template`                         |
| POST   | `/api/v1/admin/role/open`                                       | `/api/v1/admin/roles/details`                          |
| POST   | `/api/v1/admin/role/save`                                       | `/api/v1/admin/roles/save`                             |
| POST   | `/api/v1/admin/role/delete`                                     | `/api/v1/admin/roles/delete`                           |
| POST   | `/api/v1/admin/role/role-resource/load`                         | `/api/v1/admin/roles/resource-mappings/details`        |
| POST   | `/api/v1/admin/role/role-resource/save`                         | `/api/v1/admin/roles/resource-mappings/save`           |
| GET    | `/api/v1/admin/group/search`                                    | `/api/v1/admin/groups/search`                          |
| POST   | `/api/v1/admin/group/search`                                    | `/api/v1/admin/groups/search`                          |
| POST   | `/api/v1/admin/group/open`                                      | `/api/v1/admin/groups/details`                         |
| POST   | `/api/v1/admin/group/save`                                      | `/api/v1/admin/groups/save`                            |
| POST   | `/api/v1/admin/group/delete`                                    | `/api/v1/admin/groups/delete`                          |
| GET    | `/api/v1/admin/resource/initialize`                             | `/api/v1/admin/resources/metadata`                     |
| GET    | `/api/v1/admin/resource/search`                                 | `/api/v1/admin/resources/search`                       |
| POST   | `/api/v1/admin/resource/search`                                 | `/api/v1/admin/resources/search`                       |
| GET    | `/api/v1/admin/resource/new`                                    | `/api/v1/admin/resources/template`                     |
| POST   | `/api/v1/admin/resource/open`                                   | `/api/v1/admin/resources/details`                      |
| POST   | `/api/v1/admin/resource/save`                                   | `/api/v1/admin/resources/save`                         |
| POST   | `/api/v1/admin/resource/delete`                                 | `/api/v1/admin/resources/delete`                       |
| POST   | `/api/v1/admin/resource/SaveListResource`                       | `/api/v1/admin/resources/bulk-save`                    |
| GET    | `/api/v1/admin/MAsterConfig/Region/GetMaasterConfigInitialData` | `/api/v1/admin/regions/metadata`                       |
| GET    | `/api/v1/admin/Branch/Branch/new`                               | `/api/v1/admin/branches/template`                      |
| GET    | `/api/v1/admin/Branch/Branch/search`                            | `/api/v1/admin/branches/search`                        |
| POST   | `/api/v1/admin/Branch/Branch/Search`                            | `/api/v1/admin/branches/search`                        |
| POST   | `/api/v1/admin/Branch/Branch/open`                              | `/api/v1/admin/branches/details`                       |
| POST   | `/api/v1/admin/Branch/Branch/save`                              | `/api/v1/admin/branches/save`                          |
| POST   | `/api/v1/admin/Branch/Branch/delete`                            | `/api/v1/admin/branches/delete`                        |
| GET    | `/api/v1/admin/config/search`                                   | `/api/v1/admin/configurations/search`                  |
| POST   | `/api/v1/admin/config/search`                                   | `/api/v1/admin/configurations/search`                  |
| POST   | `/api/v1/admin/config/open`                                     | `/api/v1/admin/configurations/details`                 |
| POST   | `/api/v1/admin/config/save`                                     | `/api/v1/admin/configurations/save`                    |
| POST   | `/api/v1/admin/config/Load`                                     | `/api/v1/admin/configurations/list`                    |
| POST   | `/api/v1/admin/config/delete`                                   | `/api/v1/admin/configurations/delete`                  |
| GET    | `/api/v1/admin/auditlog/search`                                 | `/api/v1/admin/audit-logs/search`                      |
| POST   | `/api/v1/admin/auditlog/search`                                 | `/api/v1/admin/audit-logs/search`                      |
| POST   | `/api/v1/admin/auditlog/LoadAuditLogDetails`                    | `/api/v1/admin/audit-logs/details`                     |
| POST   | `/api/v1/admin/message/send`                                    | `/api/v1/admin/messages/send`                          |
| POST   | `/api/v1/admin/email/send`                                      | `/api/v1/admin/emails/send`                            |
| GET    | `/api/v1/auth/gettoken`                                         | `/api/v1/auth/encryption-key`                          |
| POST   | `/api/v1/register/check-email`                                  | `/api/v1/registrations/email-availability`             |
| POST   | `/api/v1/register/check-org`                                    | `/api/v1/registrations/organization-code-availability` |
| POST   | `/api/v1/register/check-org-name`                               | `/api/v1/registrations/organization-name-availability` |
| POST   | `/api/v1/register/init`                                         | `/api/v1/registrations/sessions`                       |
| POST   | `/api/v1/register/mfa-setup`                                    | `/api/v1/registrations/mfa/setup`                      |
| POST   | `/api/v1/register/verify-mfa`                                   | `/api/v1/registrations/mfa/verify`                     |
| GET    | `/api/v1/register/session/:id`                                  | `/api/v1/registrations/sessions/:id`                   |
| PUT    | `/api/v1/register/save-progress`                                | `/api/v1/registrations/progress`                       |

## Verification

Run `npm run test:backend` from the repository root. The API contract tests check route coverage, canonical path naming, unique operation IDs, declared tags, compatibility aliases, and authentication on representative renamed HTTP routes.

See [API_REFERENCE.md](API_REFERENCE.md) for the full operation catalog, and `/swagger` for the live specification. Some previously undocumented operations currently expose discovery metadata only; their request and response schemas remain defined in the corresponding route and DTO files.
