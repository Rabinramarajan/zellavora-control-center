# Review status: P0 security and CI hardening

Closes the findings of [the 2026-10-16 application review](review/APPLICATION_REVIEW.md) (commit `1557a76`). Every item is marked **Fixed** or **Justified** (left as it is, with the reason). The review itself carries the same statuses.

## Result

| Check                               | Result                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit` (apps/backend)   | Pass                                                                                         |
| `npm run lint` (apps/backend)       | Pass: 0 errors, 35 `no-explicit-any` warnings carried over from the existing code            |
| `npx jest --runInBand` (apps/backend) | Pass: 648 of 648 tests, 55 suites (the review run had 519 of 523) |
| `npm ci --dry-run` at the root      | Pass (the missing frontend workspace is gone)                                                |
| GitHub Actions run on a clean runner | **Not run.** The workflow was rewritten but only a push can prove it                         |
| Migrations `20261016000000_p0_security_permissions`, `20261016010000_notification_created_at` | **Not applied.** No database was available; it is untested on an empty and on a populated database |

## Findings

| ID  | Status    | What changed                                                                                                                                                                                                                                       |
| --- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Fixed     | `organization.routes.ts`: `authenticate` on the router. `GET /:id` needs `organizations:read`, `PUT /:id` needs `organizations:update`, `POST /` needs a platform administrator. A tenant caller only reaches its own organization (other ids answer 404). A tenant admin cannot switch `enforce2fa` off. Bodies are strict. The `/clean` alias is gone. |
| C2  | Fixed     | `adminAuthGuard` requires the `admin:access` permission or platform-administrator status instead of a non-empty role. The migration grants `admin:access` to every role that holds a console permission today.                                         |
| C3  | Fixed     | Notifications: `authenticate`; the list returns only the caller's rows (organization and user from the token), paged. `POST /send` and the hard-coded `admin@zellavora.com` `send-otp` enqueue are deleted. `NotificationService.sendNotification` stays as an in-app-only server helper for timesheets. |
| H1  | Fixed     | `TokenService` answers 503 `AUTH_UNAVAILABLE` on issue and verify when a secret is missing, under 32 bytes or a known placeholder. Defaults removed from `config/env.ts`; `collectConfigErrors` reports weak secrets. Boot still does not throw. |
| H2  | Fixed     | `POST /storage/upload`, its controller method, DTO, service method and the local-disk repository write are deleted. `POST /storage/media` remains.                                                                                                |
| H3  | Fixed     | `POST /audit-logs/log` (and its `/operations/audit-logs/log` twin), its controller method and route are deleted. Nothing in the repository called it.                                                                                              |
| H5  | Fixed     | The IAM directory (list, search, stats, get, lock) and every user-detail section and action are filtered by `userTenants.some.tenantId` from the token. Other tenants' ids answer 404. Chosen option: tenant scoping, not a platform console.      |
| H6  | Fixed     | `PermissionService`: only ACTIVE, non-deleted roles (organization or global); roles reached through ACTIVE groups; deny wins over allow, including against wildcards; the role-name fallback is off unless `PERMISSION_ROLE_NAME_FALLBACK=true`; 30-second per-user cache dropped on every role, group, assignment or menu-grant change. The User Request access preview applies the same rules. |
| H7  | Fixed (pending a CI run) | Root workspace and frontend scripts removed, lockfile regenerated; Node 24 everywhere (`engines`, workflow); backend jobs run `npm ci --prefix apps/backend` and `prisma generate`; `upload-artifact@v4`, `upload-sarif@v3`, `codecov-action@v5`, `trivy-action@0.28.0`; backend ESLint config added; workflow runs on every pull request. |
| M1  | Fixed     | `src/rbac/` and the `/api/v1/rbac` gateway are deleted, along with the Supabase and Redis start-up code in `app.ts`. `@supabase/supabase-js` and `ioredis` stay: the legacy routes, the cache and the rate limiter use them.                       |
| M2  | Fixed     | `PUT /projects/:projectId/gallery/:imageId` and `POST /technologies` validate with strict Zod allow-lists. `POST /technologies` also requires `projects:write`.                                                                                  |
| M3  | Fixed     | `/health` returns `status` and `timestamp` only. `/api/v1/health` needs sign-in and `OPERATIONS_SYSTEM_HEALTH_VIEW` (or `system:rbac:read` / `system:audit:read`, as `/operations/health` does).                                                  |
| M4  | Fixed     | Global JSON and form limit is 1 MB. `POST /storage/media` parses up to 4.5 MB after authentication and its permission check. Body-parser 413 and malformed JSON now answer 413 and 400 instead of 500.                                          |
| M5  | Fixed     | Strict Helmet defaults for the API. The relaxed policy (inline scripts, jsDelivr) is applied only under `/swagger`. There is no `/api-docs` route, so it is not listed.                                                                          |
| M6  | Fixed     | `settings/email` (get, put, test) requires a platform administrator.                                                                                                                                                                            |
| M7  | Partly fixed, partly justified | The `/api/v1/clean/*` aliases are removed. `/api/admin` and `/api/app` are **kept**: they are published as separate API surfaces with their own Swagger documents and hosts (`admin-api.`, `api.`), and the frontend that calls them is not in this repository, so I could not list their consumers. They are now safe by construction: every router they re-mount applies its own guard (`route-guard.spec.ts` proves it) and `adminAuthGuard` is a real permission check. Retire them once the consumers are confirmed. |
| M8  | Fixed     | `api-contract.spec.ts` passes: invoices and email-settings Swagger YAML errors fixed, 15 missing tags declared, IAM user and user-request sub-routes documented one by one, audit docs moved to the canonical `/operations/audit-logs` path. `settings.controller.spec.ts` expects the current `{ success, message, data }`. |
| M9  | Fixed     | `ddl.routes.ts`: `router.use(authenticate)`; `security: []` removed. The registration pages must sign in first or stop calling `/lookups`.                                                                                                       |
| M10 | Fixed     | The organization policy was already cached (30 s). `last_activity_at` is now written at most once a minute: the guard reads the session, rejects it if idle or revoked, and writes only when the stored value is over a minute old.        |
| M11 | Fixed     | Covered by C3; `notification.service.spec.ts` added.                                                                                                                                                                                             |
| L1  | Fixed     | The three `gettoken` aliases are deleted. `/api/v1/auth/gettoken` (used by login encryption) stays.                                                                                                                                              |
| L4  | Fixed     | Same as M8.                                                                                                                                                                                                                                      |
| L5  | Fixed     | Root and backend `engines` are `>=24`; `CLAUDE.md` and `AGENTS.md` say Node 24+.                                                                                                                                                                 |

## Not part of P0, still open

- **L2, L3, L7, L8** are unchanged. L6: only `frontend-core.md` got an "Archived" banner.
- `apps/backend/supabase/functions/_shared/{auth,token,encryption}.ts` (Deno edge functions) still fall back to `dev-secret-change-in-production` and `dev-refresh-secret`. They are deployed separately and nothing in `src/` calls them; fix or delete them before deploying.
- `rolePermissions.organizationId` is not part of the permission query (it never was). A role shared across organizations grants the same codes everywhere.
- `src/infrastructure/redis-keys.ts` still defines the `rbac*` key builders; nothing uses them now.
- Prettier is not enforced in CI: 47 backend files were already unformatted. Only the files this change touched were formatted.
- 35 `@typescript-eslint/no-explicit-any` warnings remain (set to `warn`).
- `PUT/POST` bodies on the organization routes are now strict, so a client that sends extra fields (for example `plan`) gets a 400.

## Follow-up for the Nexus frontend

Working on `D:\personal_github\zelavora-nexus` exposed two gaps, closed in a second pass:

- `notifications` had no creation time, so a member's feed could not be ordered. Migration `20261016010000_notification_created_at` adds `created_at` (backfilled from `sent_at`) and an index; the list orders by it.
- `GET /auth/me` now returns `user.isPlatformAdmin` (so the UI can hide platform-only screens) and `deniedPermissions` (so the UI mirrors deny-wins, including against `*:*`).

## Rollout notes

1. Run `npx prisma migrate deploy` (migrations `20261016000000_p0_security_permissions` and `20261016010000_notification_created_at`) **before** the new code takes traffic. It adds `organizations:read`, `organizations:update` and `admin:access`, grants them to existing roles, and gives every member who only had the role-name fallback an explicit role assignment.
2. Set `JWT_SECRET` and `REFRESH_TOKEN_SECRET` to values of at least 32 bytes on every environment. Without them, sign-in answers 503.
3. Role changes take effect within 30 seconds on every instance, and at once on the instance that handled the change.

## Frontend contract

Endpoints removed (drop the calls): `POST /api/v1/storage/upload`, `POST /api/v1/audit-logs/log`, `POST /api/v1/notifications/send`, everything under `/api/v1/clean/*` and `/api/v1/rbac/*`, and the `gettoken` aliases other than `/api/v1/auth/gettoken`.

Endpoints whose behavior changed:

| Endpoint                                              | Change                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `GET/PUT /api/v1/organizations/:id`                   | Sign-in required; only the caller's own id; `PUT` body is strict                                  |
| `POST /api/v1/organizations`                          | Platform administrators only                                                                      |
| `GET /api/v1/notifications`                           | Own notifications only, `?page&pageSize`, `meta: { page, pageSize, total }`; no `organizationId` query |
| `GET /api/v1/lookups`, `/types`, `/:type`             | Sign-in required                                                                                  |
| `GET/PUT/POST /api/v1/settings/email`                 | Platform administrators only                                                                      |
| `GET /api/v1/health`                                  | Needs the system-health permission; `GET /health` returns `status` and `timestamp` only           |
| `GET /api/v1/iam/users/**`                            | Only users of the caller's organization; others answer 404                                        |
| `POST /api/v1/technologies`                           | Needs `projects:write`; unknown fields answer 400                                                 |
| `PUT /api/v1/projects/:id/gallery/:imageId`           | Only `media_url`, `caption`, `order_index`                                                        |
| Any JSON body over 1 MB                               | 413 `PAYLOAD_TOO_LARGE` (media upload allows 4.5 MB)                                              |
