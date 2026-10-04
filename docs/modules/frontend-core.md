# Frontend core, shared components and layout

The Angular application shell that every feature builds on: bootstrap, HTTP pipeline, authentication state, permission checks, theming, layout, and the shared component library.

## Stack

Angular 22 standalone components, signals, zoneless change detection, OnPush everywhere (128 of 128 components), lazy-loaded feature routes, Tailwind CSS, PrimeNG (toasts, icons), `@zellavoras/ui` form controls, Angular CDK dialogs. Production build: 68 KB initial transfer.

## Bootstrap (`app.config.ts`)

1. `provideZonelessChangeDetection()`, `provideRouter(appRoutes)`.
2. HTTP interceptors, in order: correlation id → API base URL → logging → auth → retry → error; plus the DI-based policy-version interceptor.
3. App initialiser: load `assets/appsettings.json` (`ConfigService`), then `AuthService.initialize()` restores the session from the stored refresh token.
4. `app.component.ts` renders `AdminLayoutComponent` and starts the analytics tracker.

## `core/`

| Folder          | Contents                                                                                                                                                                                                                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth/`         | `AuthService` (sign-in, MFA, refresh, storage), `AuthStore` (signals: user, tenant, tokens, permissions), `authGuard`, `canMatchPermission(code)`, `authInterceptor` (adds `Authorization`, `X-Tenant-ID`, `X-Request-ID`; one shared refresh on 401, then retry; sends the user to `/auth/session-expired` if refresh fails), `auth-errors.ts` |
| `http/`         | `apiBaseUrlInterceptor` (prefixes the API host from `appsettings.json`), `ApiDataService` (typed `getData`/`postData`/…), correlation id, logging, `retryInterceptor` (2 retries, 1 s apart, on status 0 or 503)                                                                                                                                |
| `error/`        | `errorInterceptor` (normalises errors, pushes non-fatal ones to the toast bus), `ErrorBus`                                                                                                                                                                                                                                                      |
| `api/`          | One client per backend area: `iam-admin`, `iam`, `user-admin`, `user-requests`, `analytics`, `audit`, `blog`, `cms-builder`, `notification`, `project`, `system-health`, `themes`                                                                                                                                                               |
| `repositories/` | Thin caching layers over some APIs (audit, CMS builder, notifications, projects, system health)                                                                                                                                                                                                                                                 |
| `rbac/`         | `PermissionService`, `PolicyStore`, `*hasPermission` structural directive, policy-version interceptor (refreshes permissions when the server's `X-Policy-Version` rises)                                                                                                                                                                        |
| `theme/`        | `ThemeRuntimeService`: applies the organization theme (see [themes](themes.md))                                                                                                                                                                                                                                                                 |
| `services/`     | `ThemeService` (light/dark/system, stored as `zcc-theme`; sign-in pages forced dark), `LayoutService` (sidebar state), `ApiIntegrationService` (settings page calls)                                                                                                                                                                            |
| `analytics/`    | `AnalyticsTrackerService`: posts a page view per navigation                                                                                                                                                                                                                                                                                     |
| `config/`       | `ConfigService`: runtime configuration                                                                                                                                                                                                                                                                                                          |

## Routing (`app.routes.ts`)

Every feature is lazy. Signed-in routes use `canActivate: [authGuard]`; permission-gated areas add `canMatch: [canMatchPermission('…')]` so the chunk is never loaded for users without access.

| Path                                                     | Feature                                | Gate                                       |
| -------------------------------------------------------- | -------------------------------------- | ------------------------------------------ |
| `/auth/*`                                                | auth                                   | public                                     |
| `/account/*`                                             | account                                | signed in                                  |
| `/dashboard`                                             | dashboard                              | signed in                                  |
| `/iam/*`                                                 | iam                                    | per child (`users:read`, `roles:read`, …)  |
| `/system/*`                                              | system (configuration, communications) | `settings:manage`                          |
| `/operations/*`                                          | operations                             | per child                                  |
| `/freelancer-sheets/*`, `/timesheets/*`                  | sheets                                 | signed in                                  |
| `/cms/*`, `/blog/*`                                      | content                                | `cms:read`, `blog:read`                    |
| `/media`, `/theme-builder`, `/analytics`                 |                                        | signed in, `themes:read`, `analytics:read` |
| `/projects/*`, `/portfolio/*`                            |                                        | signed in                                  |
| `/settings/:tab`, `/notifications`, `/users`, `/admin/*` |                                        | signed in                                  |
| `/audit-logs`, `/system-health`, `/cms-builder`          |                                        | redirects                                  |
| `**`                                                     |                                        | redirect to `/dashboard`                   |

The sidebar menu comes from the backend (`GET /auth/me`, built by `services/auth/menu.service.ts` and filtered by permission); see [MENU_LIST.md](../MENU_LIST.md).

## `shared/`

| Component                                                  | Purpose                                                                                                                                                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin-layout`, `sidebar` (+ `sidebar-nav-node`), `navbar` | Shell: collapsible sidebar tree, sticky top bar with theme toggle and profile menu (sign out)                                                                                                       |
| `data-table`                                               | Sortable, selectable table with toolbar slots, skeleton loading, empty/error states, responsive column hiding, sticky header                                                                        |
| `pagination`                                               | Page buttons, summary, rows-per-page                                                                                                                                                                |
| `dialog`                                                   | CDK dialog service: `open`, `confirm`, `alert`, `prompt`; shell with title, busy bar and actions; center, drawer, bottom-sheet and full-screen positions (see `shared/components/dialog/README.md`) |
| `form-dialog`                                              | Schema-driven form in a dialog, with validation helpers                                                                                                                                             |
| `filter-chips`, `date-range-picker`, `document-upload`     | Inputs                                                                                                                                                                                              |
| `iam/`                                                     | `status-chip`, `empty-state`, `filter-bar`, `detail-tabs`, `json-diff-viewer`                                                                                                                       |
| `theme-toggle`                                             | Light/dark switch                                                                                                                                                                                   |

Utilities: `brand-palette.ts` (shade generation, WCAG contrast), `create-list-store.ts` (signal-based list state), `csv-exporter.ts`, `form-patterns.ts`. Models for every API live in `shared/models/`.

## Styling

`src/styles/global.css` (tokens, scrollbars, toast skin, auth tokens), `zellavora-ui.scss` (form-control theme, dialog tokens), `_theme-light.scss` (maps dark-only utilities to light equivalents under `html.light`), `auth.css`, `tailwind.config.js` (`indigo-*` reads the tenant brand variables; radii follow `--app-radius`). The ZCC design system documents these tokens and components.

## Tests

133 Karma/Jasmine specs pass (`ng test`). Run with Node ≥ 22.22.3; as root in a container, Chrome needs `--no-sandbox` (add a `ChromeHeadlessCI` custom launcher to `karma.conf.js`). Playwright is configured (`playwright.config.ts`, `e2e/`) but has no critical-flow specs.

## Review notes

- Refresh token in Web Storage (review **M3**).
- `retryInterceptor` retries **any** method on status 0 or 503, including POSTs such as approve, submit or send email. A request that reached the server before the connection dropped can run twice (review **M15**). Retry only GET/HEAD, or idempotent requests carrying an idempotency key.
- `apiBaseUrlInterceptor` has a large dead routing table and legacy admin mappings (**M14**).
- `ng lint` reports 1,552 errors (**L2**); the Angular CLI requires Node ≥ 22.22.3 but CI uses Node 20 (**H7**).
- Unrouted features to delete: `features/audit-logs`, `features/system-health`, `features/cms-builder`.
