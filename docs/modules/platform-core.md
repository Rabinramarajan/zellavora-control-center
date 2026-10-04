# Platform core (backend)

The Express application shell: bootstrap, configuration, middleware, infrastructure services, health checks and API documentation. Every feature module runs inside it.

## Code

| Path                                                                         | Role                                                                                                           |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/backend/api/index.ts`                                                  | Vercel serverless entry. Exports the Express app; logs unhandled rejections instead of crashing the instance.  |
| `apps/backend/src/index.ts`                                                  | Long-lived server entry (local, Docker). Calls `assertConfigValid()` and `listen()`.                           |
| `apps/backend/src/app.ts`                                                    | Builds the app: middleware order, health endpoints, route registration, lazy RBAC gateway, 404, error handler. |
| `apps/backend/src/routes/index.ts`                                           | `registerApiRoutes()`: mounts every module under `/api/v1`, plus compatibility aliases.                        |
| `src/config/env.ts`                                                          | Typed `config` object from environment variables; `collectConfigErrors()` never throws at import.              |
| `src/config/supabase.ts`                                                     | Lazily built Supabase clients (service role and anon).                                                         |
| `src/config/swagger.ts`, `src/routes/swagger.ts`                             | OpenAPI spec from JSDoc; UI at `/swagger/index.html`, `/` redirects there.                                     |
| `src/middleware/auth.ts`                                                     | `authenticate`, `requirePermission(...codes)`, aliases `authenticateToken`, `authGuard`.                       |
| `src/middleware/error.ts`                                                    | `AppError` and the central error handler.                                                                      |
| `src/middleware/response-envelope.ts`                                        | Normalises JSON responses to one envelope.                                                                     |
| `src/middleware/rate-limit.ts`                                               | `createRateLimiter({ bucket, windowMs, limit })`, Redis-backed when `REDIS_URL` is set.                        |
| `src/middleware/request-context.ts`, `src/infrastructure/request-context.ts` | AsyncLocalStorage with actor, IP, user agent, request id for audit.                                            |
| `src/middleware/org-context.ts`                                              | `OrgContext` helper used by tenant-scoped modules (blog, CMS, themes).                                         |
| `src/middleware/async-handler.ts`                                            | Wraps async handlers so rejections reach the error handler.                                                    |
| `src/infrastructure/prisma.ts`                                               | Prisma client singleton, `BaseRepository` with transaction-aware `getDb(tx)`.                                  |
| `src/infrastructure/logger.ts`                                               | Winston logger.                                                                                                |
| `src/infrastructure/audit.ts`                                                | Server-side audit writer used by services.                                                                     |
| `src/infrastructure/cache.ts`, `redis.ts`, `redis-keys.ts`                   | LRU and Redis caching, key naming.                                                                             |
| `src/infrastructure/queue.ts`                                                | BullMQ queue (`addQueueJob`) with an inline fallback when Redis is absent.                                     |
| `src/infrastructure/pagination.ts`                                           | Shared paging helpers.                                                                                         |
| `src/services/email.service.ts`, `email.templates.ts`, `email-config.ts`     | Nodemailer transport (SMTP or console) and templates.                                                          |

## Request pipeline

Registered in this order (`app.ts`):

1. `trust proxy` (client IP from `X-Forwarded-For` on Vercel)
2. Swagger routes, `/favicon.png`
3. `express.json` / `urlencoded`, 50 MB limit
4. Response envelope
5. CORS (`VITE_CORS_ORIGINS`, credentials on)
6. Helmet with CSP; HSTS in production
7. Rate limit on `/api/v1/auth` (120 requests/minute per IP)
8. Request context
9. `/health`, `/api/v1/health`, `/info`
10. `registerApiRoutes(app)`
11. `/api/v1/rbac` gateway (initialises Supabase + Redis on first request)
12. 404 JSON handler
13. Error handler

## Authentication and permissions

- **`authenticate`** reads `Authorization: Bearer <jwt>`, verifies it (HS256), sets `req.userId`, `req.tenantId` (`tid`), `req.role`, `req.sessionId`, and checks the session is still active and inside the organization's idle timeout. Logout, revocation and password reset therefore take effect on the next request.
- **`requirePermission(...codes)`** loads the caller's effective permission set once per request (`services/auth/permission.service.ts`) and passes if any code matches. Codes accept wildcards (`users:*`).
- Both must be applied per route; there is no global guard. See the review's route-guard test recommendation.

## Error format

```json
{
  "error": { "message": "Insufficient permission", "code": "FORBIDDEN_PERMISSION", "status": 403 },
  "msg": {
    "errorMessage": ["Insufficient permission"],
    "infoMessage": { "id": 0, "msg": "", "msgType": "Information" }
  }
}
```

The `msg` block is added to every JSON object response by `response-envelope.ts` for older clients. `org-context.ts` exposes `orgContextOf(req)`, which returns `{ organizationId, actorId }` from the token; tenant-scoped modules start from it.

Zod failures return 400 with `code: "VALIDATION_ERROR"` and a `fields` map. Unknown errors return 500 and hide the message in production.

## Health endpoints

| Endpoint                                               | Auth   | Returns                                                             |
| ------------------------------------------------------ | ------ | ------------------------------------------------------------------- |
| `GET /health`                                          | Public | `ok` or `degraded`, environment, config errors, RBAC failure reason |
| `GET /api/v1/health`                                   | Public | CPU, RAM, database probe, storage, Redis, queue                     |
| `GET /info`                                            | Public | Service name, version, endpoints                                    |
| `GET /api/v1/operations/health/liveness`, `/readiness` | Public | Probe results (see [operations](operations.md))                     |

## Configuration

Required everywhere: `JWT_SECRET`, `REFRESH_TOKEN_SECRET`. Required in production: `ENCRYPTION_KEY` (≥ 32 chars), `APP_URL`, `SMTP_HOST`. Common optional variables:

| Variable                                            | Default                 | Purpose                                                            |
| --------------------------------------------------- | ----------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`                                      | —                       | PostgreSQL for Prisma                                              |
| `REDIS_URL`                                         | unset                   | Rate-limit store, caches, BullMQ, RBAC engine                      |
| `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`    | —                       | Supabase client for legacy routes and the RBAC engine              |
| `BLOB_READ_WRITE_TOKEN`                             | —                       | Vercel Blob for media                                              |
| `VITE_CORS_ORIGINS`                                 | `http://localhost:4200` | Comma-separated allowed origins                                    |
| `EMAIL_PROVIDER`                                    | `console`               | `smtp` to send real mail                                           |
| `ALLOW_SELF_REGISTRATION`                           | `false`                 | Opens `/auth/register`                                             |
| `JWT_EXPIRY` / `REFRESH_TOKEN_EXPIRY`               | `15m` / `7d`            | Token lifetimes                                                    |
| `DEV_PASSWORDLESS_LOGIN`, `DEV_PASSWORDLESS_EMAILS` | off                     | Local-only password bypass; forced off in production and on Vercel |

## Deployment

`apps/backend/vercel.json` rewrites every path to `api/index.ts` (region `icn1`, 30 s, 1 GB). Migrations: `npm run db:migrate:deploy`. Seeds: `db:seed`, `db:seed:owner`, `db:seed:freelancer`.

## Tests

`middleware/rate-limit.spec.ts`, `middleware/response-envelope.spec.ts`, `infrastructure/redis-keys.spec.ts`, `routes/api-contract.spec.ts` (currently failing: spec and routes have drifted).

## Review notes

- JWT secrets fall back to fixed strings when unset (review **H1**).
- Health endpoints are public and verbose (**M4**); the member-portal route in `app.ts` is unexplained (**M5**).
- 50 MB body limit (**M6**); `'unsafe-inline'` scripts in the global CSP (**M7**).
- Each authenticated request writes `sessions.last_activity_at` (**M10**).
- `console.*` used instead of the Winston logger (**L1**).
