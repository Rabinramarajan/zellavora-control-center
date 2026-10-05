# Dashboard and analytics

The landing page after sign-in (KPIs, trends, activity feed) and the web analytics report built from page views the admin app records about itself.

## Code

| Area      | Backend                                                                                            | Frontend                                                                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard | `modules/dashboard/` (`dashboard.service.ts` with optional Redis cache, `dashboard.repository.ts`) | `features/dashboard/` (`dashboard.component`, `dashboard.store.ts`, `dashboard.api.ts`, `kpi-card`, `trend-chart`, `plan-donut`, `dashboard-icon`) |
| Analytics | `modules/analytics/` (`analytics.service.ts`, `analytics.repository.ts`, optional Redis cache)     | `features/analytics/` (`analytics.component`, `ranked-list`), `core/api/analytics.api.ts`                                                          |
| Tracker   | —                                                                                                  | `core/analytics/analytics-tracker.service.ts`, started in `app.component.ts`                                                                       |

## Dashboard API

Base path `/api/v1/dashboard`; both routes need `dashboard:read`.

| Method | Path        | Query                                             | Returns                                                                                                                                                                                 |
| ------ | ----------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/overview` | `range` = `7`, `30` (default) or `90` days        | Scope marker, a KPI list, trend series (`primary`, `secondary`, `activity`), donut panel copy and its slices |
| GET    | `/activity` | `range`, `page`, `pageSize`, `action`, `severity` | Recent audit entries for the feed, narrowed to the caller's scope                                            |

### Scoping

`dashboard.scope.ts` derives the scope from verified JWT claims only — a client-supplied tenant id or role is never read, so a caller cannot widen their own view.

| Scope          | Who                               | Narrowed by                        | KPI set                                                                            |
| -------------- | --------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| `organization` | any non-`Individual` role         | `organizationId` = `req.tenantId`  | organizations, members, active sessions, pending invites, audit events, critical alerts |
| `individual`   | role `Individual`                 | `organizationId` **and** `userId`  | projects, sheets, media, active sessions, own activity, critical alerts            |

INDIVIDUAL accounts all join the same default organization, so a tenant filter alone would still expose their peers; their aggregations are additionally narrowed to their own user id, and their audit feed to rows they produced (`actorId`).

The API also supplies the KPI labels, trend legend and donut panel copy, so the client renders both scopes through one code path.

Results are cached per range **and per scope** (`org:<tenant>` or `ind:<tenant>:<user>`) in Redis when it is configured; `invalidate(range, scope)` clears them.

## Analytics API

Base path `/api/v1/analytics`; the whole router requires sign-in.

| Method | Path                                                                                        | Permission               | Purpose                                                        |
| ------ | ------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------- |
| POST   | `/events`                                                                                   | signed in (rate-limited) | Record a page view or named event                              |
| GET    | `/overview`                                                                                 | `analytics:read`         | Visitors, sessions, page views, bounce and trend for the range |
| GET    | `/top-pages`, `/top-referrers`, `/top-countries`, `/top-cities`, `/top-browsers`, `/top-os` | `analytics:read`         | Ranked lists                                                   |
| GET    | `/device-breakdown`                                                                         | `analytics:read`         | Desktop / mobile / tablet split                                |
| GET    | `/export`                                                                                   | `analytics:export`       | CSV export                                                     |

Event body: `sessionId` (UUID, kept in sessionStorage), `visitorId` (kept in localStorage), `eventType` `pageview` or `event`, optional `eventName`, `path` (must start with `/`), `title`, `referrer`. Country, city, browser, OS and device are derived on the server from request headers. Events are stored per organization.

## Data model

`AnalyticsEvent`, `AnalyticsSession` (enum `AnalyticsEventType`). The dashboard reads `Organization`, `User`, `Session`, `Invitation` and `AuditLog`.

## Frontend

| Route        | Permission                              | Screen                                                                       |
| ------------ | --------------------------------------- | ---------------------------------------------------------------------------- |
| `/dashboard` | signed in (data needs `dashboard:read`) | KPI cards with deltas, trend charts, plan donut, activity feed, range picker |
| `/analytics` | `analytics:read`                        | Overview, ranked lists, device breakdown, export                             |

The tracker listens to router navigation and posts a page view for each route change, so the analytics report describes how staff use ZCC, not a public website.

## Tests

`analytics/analytics.service.spec.ts`, `features/dashboard/dashboard.component.spec.ts`, `dashboard.store.spec.ts`. No tests for the dashboard service or repository, or for the analytics UI.

## Review notes

- ~~**The dashboard is platform-wide.**~~ Resolved (review **H5**): every aggregation is now narrowed by `resolveScope()`, and individual accounts receive a personal KPI set scoped to their own user id. See **Scoping** above.
- Analytics events are posted with the user's token, so only signed-in usage is measured; that matches the stated purpose.
