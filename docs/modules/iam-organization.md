# IAM: organizations, branches, departments and teams

The organizational structure inside a tenant. An **organization** (tenant, identified by a client code) contains **branches** (locations), **departments** (a tree) and **teams**. Users belong to an organization through `UserTenant`, which also carries their department; they can be members of teams; a branch is set on the user.

## Code

| Layer         | Path                                                                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organizations | `apps/backend/src/modules/organization/`                                                                                                                                          |
| Branches      | `apps/backend/src/modules/branch/`                                                                                                                                                |
| Departments   | `apps/backend/src/modules/departments/`                                                                                                                                           |
| Teams         | `apps/backend/src/modules/teams/`                                                                                                                                                 |
| Tenant lookup | `apps/backend/src/services/auth/tenant.service.ts`                                                                                                                                |
| Frontend      | `features/iam/organization/` (departments and teams list/detail), `features/admin/components/branches/branch-manager/` (branches, reused under IAM), `features/iam/members-panel` |
| Frontend API  | `core/api/iam-admin.api.ts` (`/iam/departments`, `/iam/teams`, branches)                                                                                                          |

## API

**Organizations** `/api/v1/organizations` (alias `/api/v1/clean/organizations`)

| Method | Path   | Guard    | Purpose                                                           |
| ------ | ------ | -------- | ----------------------------------------------------------------- |
| GET    | `/:id` | **none** | Read an organization                                              |
| POST   | `/`    | **none** | Create (name, client code, logo); plan `enterprise`, 2FA enforced |
| PUT    | `/:id` | **none** | Update name, logo, `enforce2fa`                                   |

**Branches** `/api/v1/branches` (alias `/api/v1/clean/branches`)

| Method            | Path        | Permission                     |
| ----------------- | ----------- | ------------------------------ |
| GET               | `/`, `/:id` | `users:read` or `users:manage` |
| POST, PUT, DELETE | `/`, `/:id` | `users:manage`                 |

**Departments** `/api/v1/iam/departments`

| Method            | Path                                   | Permission                     |
| ----------------- | -------------------------------------- | ------------------------------ |
| GET               | `/`, `/:id`                            | `users:read` or `users:manage` |
| POST, PUT, DELETE | `/`, `/:id`                            | `users:manage`                 |
| POST / DELETE     | `/:id/members`, `/:id/members/:userId` | `users:manage`                 |

**Teams** `/api/v1/iam/teams`: same shape and permissions as departments.

## Rules

- Branches, departments and teams are scoped to the caller's organization (`req.tenantId`); names are unique within it.
- Departments form a tree; the service refuses a parent change that would create a cycle (`assertNoCycle`).
- Deletes are audited with the actor.

## Data model

`Organization` (client code, plan, `enforce2fa`, logo), `OrganizationSettings`, `UserTenant` (organization role `OrganizationRole`, department), `Branch`, `Department`, `Team`, `Workspace`.

## Frontend

| Route                                               | Permission   | Screen                                  |
| --------------------------------------------------- | ------------ | --------------------------------------- |
| `/iam/organization/branches`                        | `users:read` | Branch manager                          |
| `/iam/organization/departments`, `/departments/:id` | `users:read` | Department list and detail with members |
| `/iam/organization/teams`, `/teams/:id`             | `users:read` | Team list and detail with members       |

There is no screen for editing the organization itself. The organization is chosen at sign-in by client code; the API supports switching (`POST /auth/switch-tenant`), but the frontend has no switcher yet.

## Tests

`branch/branch.service.spec.ts`, `departments/departments.service.spec.ts`, `services/auth/tenant.service.spec.ts`, `core/api/iam-admin.api.spec.ts`. None for `organization` or `teams`.

## Review notes

- **Organization endpoints have no authentication at all** (review **C1**). Anyone can create organizations or switch off an organization's mandatory 2FA.
- Branch and department management reuse `users:read` / `users:manage`; consider dedicated `org:*` keys so HR-style structure edits do not imply user administration.
- The legacy `/api/v1/admin/branches/*` routes duplicate the branch module without permission checks (**C2**).
