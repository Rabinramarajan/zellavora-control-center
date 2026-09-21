# Application structure and cleanup

Structural review performed on 2026-09-21 across the Angular admin and Express backend.

## Folder responsibilities

```text
apps/admin/src/app/
  core/                 Application-wide auth, HTTP, API clients and repositories
  features/             Routed screens and feature-owned services/models
  shared/               Reusable UI, directives and common models

apps/backend/src/
  app.ts                Application composition, middleware order and lazy RBAC setup
  index.ts              Server startup
  routes/index.ts       API route registration, preserving public paths and order
  routes/swagger.ts     Swagger UI and spec endpoints
  routes/               Existing legacy API handlers
  middleware/           Cross-cutting request and response handling
  modules/              Feature routes, controllers, services, DTOs and repositories
  services/             Existing shared and authentication services
  infrastructure/       Database clients, logging, queues and request context
  rbac/                 RBAC engine and its services
```

Add feature-specific business logic to its service, transport validation to DTOs/controllers,
and persistence operations to repositories. Keep route registration in `routes/index.ts`.
Do not introduce another generic service layer around an existing feature service.

Legacy `/api/v1/admin`, `/api/v1/auth`, modular `/api/v1/clean`, and `/api/v1/iam`
endpoints are all mounted. Similar filenames in these groups do not prove duplication:
their public contracts must be migrated before deleting a group.

## Changes made

- Extracted API registration, Swagger setup and the response-envelope middleware from `app.ts`.
  Middleware ordering, 35 API mounts, compatibility endpoints and lazy RBAC initialization remain intact.
- Consolidated loading, error handling and cleanup for 23 admin-store operations in `runOperation`.
  Existing result updates and error messages remain in each operation.
- Reused the typed tenant mapper for organization lookups; removed the unused alternative mapper
  and two duplicate mapping blocks.
- Removed unused service members, an empty constructor/lifecycle hook, and unused repository callback parameters.
- Enabled `noUnusedLocals` for application compilation in both apps.
- Fixed root type checking to check both apps with their own compiler versions; frontend checking
  includes the application and test configurations.
- Added `build:all`, `test:backend`, `test:all` and a non-mutating `format:check` command.
- Restored the missing Angular lint target, removed the invalid root TypeScript project reference
  from ESLint, and corrected the misspelled return-type rule.
- Updated CI to install backend dependencies for the expanded type check and to check formatting without rewriting files.

Import tracing covered runtime, lazy imports, test and seed entry points. It found no orphan
application module suitable for deletion. `environment.prod.ts` is a configured file replacement;
`test-setup.ts` is explicitly included by the test configuration. Both are retained.
Existing local authentication changes were left intact.

## Verification

Install root and backend dependencies separately (`npm ci` and `npm ci --prefix apps/backend`).
The backend is not a root npm workspace.

| Check | Result |
| --- | --- |
| `npm run type-check` | Passed for frontend application/tests and backend |
| `npm run build:admin` | Passed, production configuration |
| `npm run build:backend` | Passed, including Prisma client generation |
| `npm run test:admin` | 84 tests passed in headless Chrome |
| `npm run test:backend` | 68 tests passed across 6 suites |
| API mount comparison | All 35 extracted mounts retain their paths and order |
| `git diff --check` | Passed |
| `npm run lint` | Runs now, but fails on existing code-quality debt |

The added tests cover store loading/error lifecycle and HTTP response-envelope compatibility.
Browser E2E flows and live database integrations were not exercised.

## Remaining work

1. **Lint baseline:** the restored frontend check reports 21,970 errors in this checkout,
   including many CRLF/formatting violations, missing access modifiers/return types,
   selector rules and `any` usage. The count is sensitive to checkout line endings.
   Normalize formatting in a separate mechanical change, then address semantic violations by feature.
   The existing rules have not been disabled to make the check appear successful.
2. **Mock data and unfinished screens:** audit, CMS builder, notification, system-health and
   theme-builder repositories contain fallback/demo behavior. Analytics has static sample data.
   Legacy branch/resource/role actions include empty handlers. Decide the intended product behavior
   before replacing these with real API flows or removing their UI.
3. **Search/detail model mismatch:** legacy admin search rows are cast through `any[]` to detail models.
   Define explicit search-to-view models/mappers before removing these casts; the shapes differ.
4. **API consolidation:** migrate consumers and test compatibility before retiring legacy routes.
   Avoid moving all files just to make folder names uniform.
5. **Backend type safety:** strict mode remains disabled. Enable it incrementally with DTO and
   repository typing work, rather than hiding errors with assertions.
6. **Deployment configuration:** older workflow commands and runtime versions still need a dedicated
   review (for example, `deploy.yml` references missing `test:ci` and Node 18). Existing root deploy
   commands only print messages. This cleanup does not establish deployment readiness.

This is a verified structural cleanup, not a claim that all application behavior or lint debt is resolved.
