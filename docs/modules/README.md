# Module documentation

One page per functional module of Zellavora Control Center. Each page covers purpose, where the code lives (backend and frontend), every endpoint with its guard, the data model, business rules, screens, tests, and the module's open review findings.

The full review, with severities and a fix plan, is in [review/APPLICATION_REVIEW.md](../review/APPLICATION_REVIEW.md). Finding IDs (C1, H5, M3, …) in these pages refer to it.

## Map

| Module                                                                    | Backend                                                                                    | Frontend                                                                | Open findings    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ---------------- |
| [Platform core](platform-core.md)                                         | `app.ts`, `routes/index.ts`, `config/`, `middleware/`, `infrastructure/`                   | —                                                                       | H1, M4–M7, M10   |
| [Frontend core and shared](frontend-core.md)                              | —                                                                                          | `core/`, `shared/`, `app.routes.ts`                                     | M3, M14, M15, H7 |
| [Auth and account](auth-and-account.md)                                   | `modules/auth`, `modules/invitation`, `services/auth`                                      | `features/auth`, `features/account`                                     | H1, M3, L8       |
| [IAM: users and user requests](iam-users.md)                              | `modules/users`, `modules/user-requests`                                                   | `features/iam/users`, `features/iam/user-requests`                      | **H5**, C2       |
| [IAM: roles, groups, resources, permissions](iam-access-control.md)       | `modules/roles`, `groups`, `resources`, `permission`, `rbac/`                              | `features/iam/roles`, `groups`, `resources`, `permissions`, `core/rbac` | **H6**, M1       |
| [IAM: organizations, branches, departments, teams](iam-organization.md)   | `modules/organization`, `branch`, `departments`, `teams`                                   | `features/iam/organization`                                             | **C1**           |
| [IAM: security, sessions, configuration, communications](iam-security.md) | `modules/security-policy`, `sessions`, `configuration`, `communications`, `email-settings` | `features/iam/security`, `sessions`, `configuration`, `communications`  | M12              |
| [Operations](operations.md)                                               | `modules/operations/health`, `modules/audit`, `routes/admin-audit.ts`                      | `features/operations`                                                   | **H3**, **H4**   |
| [Dashboard and analytics](dashboard-and-analytics.md)                     | `modules/dashboard`, `modules/analytics`                                                   | `features/dashboard`, `features/analytics`                              | **H5**           |
| [Content: CMS and blog](content-cms-and-blog.md)                          | `modules/cms`, `modules/blog`                                                              | `features/cms`, `features/blog`                                         | —                |
| [Media and storage](media-and-storage.md)                                 | `modules/storage`                                                                          | `features/media`                                                        | **H2**           |
| [Themes](themes.md)                                                       | `modules/themes`                                                                           | `features/theme-builder`, `core/theme`                                  | —                |
| [Freelancer sheets](freelancer-sheets.md)                                 | `modules/daily-sheets`, `modules/monthly-sheets`                                           | `features/freelancer-sheets`                                            | L9               |
| [Timesheets](timesheets.md)                                               | `modules/timesheets`                                                                       | `features/timesheet`                                                    | —                |
| [Portfolio and projects](portfolio-and-projects.md)                       | `routes/projects.ts`, `portfolio.ts`, `gallery.ts`, `technologies.ts`                      | `features/portfolio`, `features/projects`                               | M2, M13          |
| [Settings, notifications, lookups](settings-notifications-lookups.md)     | `routes/settings.ts`, `modules/settings`, `modules/notification`, `modules/ddl`            | `features/settings`, `features/notifications`                           | **C3**, M11      |
| [Legacy admin](legacy-admin.md)                                           | `routes/admin-*.ts`                                                                        | `features/admin`, `features/users`                                      | **C2**, H4, M8   |

## Conventions used in every backend module

```
modules/<name>/
├── <name>.routes.ts       Express router; guards and Swagger JSDoc live here
├── <name>.controller.ts   Parse request (Zod), call service, shape response
├── <name>.service.ts      Business rules, audit, cache invalidation
├── <name>.repository.ts   Prisma access (extends BaseRepository; transaction-aware)
├── <name>.dto.ts          Zod schemas and inferred types
└── <name>.*.spec.ts       Jest tests
```

Guards are per route: `authenticate` then `requirePermission('<resource>:<action>', …)`. Tenant-scoped modules take the organization from the token through `orgContextOf(req)` or `req.tenantId`, never from the request body.

## Existing topic guides

[API_REFERENCE.md](../API_REFERENCE.md) · [API_NAMING.md](../API_NAMING.md) · [USERS_MODULE.md](../USERS_MODULE.md) · [USER_REQUESTS.md](../USER_REQUESTS.md) · [ROLES_MODULE.md](../ROLES_MODULE.md) · [ADMIN_MODULE_SETUP.md](../ADMIN_MODULE_SETUP.md) · [TIMESHEET_MODULE.md](../TIMESHEET_MODULE.md) · [FREELANCER_SHEETS_IMPLEMENTATION.md](../FREELANCER_SHEETS_IMPLEMENTATION.md) · [EMAIL_SERVICE.md](../EMAIL_SERVICE.md) · [MENU_LIST.md](../MENU_LIST.md) · [CODE_CLEANUP.md](../CODE_CLEANUP.md) · [GALAXY_SOFAS.md](../GALAXY_SOFAS.md)
