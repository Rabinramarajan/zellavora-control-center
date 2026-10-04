# Operations: system health and audit logs

Tools for operators: dependency health with per-service detail, and a searchable, exportable audit trail of every significant action.

## Code

| Area              | Backend                                                                                                                   | Frontend                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| System health     | `modules/operations/health/` (`health.checkers.ts`, `health.service.ts`, `health.controller.ts`)                          | `features/operations/system-health/` (`health-summary`, `health-service-table`, `health-service-details`) |
| Audit logs        | `modules/audit/` (`audit.service.ts`, `audit.repository.ts`, `audit.sanitizer.ts`)                                        | `features/operations/audit-logs/` (`audit-log-search`, `audit-filter`, `audit-table`, `audit-details`)    |
| Audit writers     | `infrastructure/audit.ts`, `services/auth/audit.service.ts`, `rbac/services/audit.service.ts`                             | —                                                                                                         |
| Legacy audit read | `routes/admin-audit.ts`                                                                                                   | `core/api/audit.api.ts`                                                                                   |
| Frontend data     | `core/api/system-health.api.ts`, `core/repositories/system-health.repository.ts`, `core/repositories/audit.repository.ts` |                                                                                                           |

## System health

Base path `/api/v1/operations/health` (alias `/api/v1/system-health`).

| Method | Path                   | Guard                                                          | Purpose                     |
| ------ | ---------------------- | -------------------------------------------------------------- | --------------------------- |
| GET    | `/liveness`            | Public                                                         | Process is up               |
| GET    | `/readiness`           | Public                                                         | Dependencies are reachable  |
| GET    | `/`                    | `OPERATIONS_SYSTEM_HEALTH_VIEW`, `system:rbac:read` or similar | Summary across all checkers |
| GET    | `/services`            | same                                                           | One row per checked service |
| GET    | `/services/:serviceId` | same                                                           | Detail for one service      |

Checkers (`health.checkers.ts`): **Database** (Prisma round trip), **Auth**, **Storage** (Vercel Blob or Supabase Storage), **Cache** (Redis), **Queue** (BullMQ), **Application** (process, memory, uptime). Each returns a status, latency and metadata. The app-level `/health` and `/api/v1/health` endpoints are described in [platform core](platform-core.md).

## Audit logs

Base path `/api/v1/operations/audit-logs` (aliases `/api/v1/audit-logs`, `/api/v1/clean/audits`).

| Method | Path              | Permission                                                  | Purpose                                                                                                   |
| ------ | ----------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| GET    | `/`               | `AUDIT_LOG_VIEW`, `system:audit:read` or `system:rbac:read` | Search: page, size (≤100), sort, date range, user, module, action, resource type and id, status, severity |
| GET    | `/filter-options` | `AUDIT_LOG_VIEW` or `system:audit:read`                     | Values for the filter dropdowns                                                                           |
| GET    | `/export`         | `AUDIT_LOG_EXPORT` or `system:audit:export`                 | CSV export of the current filter                                                                          |
| GET    | `/:id`            | `AUDIT_LOG_VIEW` or `system:audit:read`                     | Detail with before/after data                                                                             |
| POST   | `/log`            | signed in only                                              | Write an audit record from the client                                                                     |

Legacy: `GET /api/v1/admin/audit` and `/admin/audit/export` (signed in only; up to 1,000 rows).

Every read is scoped to the caller's organization. Records carry actor, action, module, resource, HTTP method, endpoint, status, severity (`info`, `warn`, `critical`), IP, user agent, correlation id and before/after snapshots. `audit.sanitizer.ts` strips passwords, tokens, API keys, cookies and other secrets before anything is stored.

## Data model

`AuditLog`.

## Frontend

| Route                           | Permission                      | Screen                                           |
| ------------------------------- | ------------------------------- | ------------------------------------------------ |
| `/operations/system-health`     | `OPERATIONS_SYSTEM_HEALTH_VIEW` | Summary cards, service table, detail drawer      |
| `/operations/audit-logs`        | `AUDIT_LOG_VIEW`                | Filter bar, results table, detail with JSON diff |
| `/audit-logs`, `/system-health` |                                 | Redirects to the routes above                    |

`features/audit-logs/` and `features/system-health/` are older versions that no route loads; delete them.

## Tests

`operations/health/health.service.spec.ts`, `audit/audit.sanitizer.spec.ts`, `features/audit-logs/*.spec.ts` and `features/system-health/*.spec.ts` (both for the unrouted versions). Nothing covers `audit.service.ts` search or the routed operations components.

## Review notes

- `POST /log` lets any signed-in user write records for any organization and actor (review **H3**).
- The legacy `/admin/audit` read skips the audit permission, and the frontend's `audit.api.ts` still uses it (**H4**).
- Three separate audit writers exist (infrastructure, auth, RBAC). Converge on `infrastructure/audit.ts` so every record passes the sanitizer.
