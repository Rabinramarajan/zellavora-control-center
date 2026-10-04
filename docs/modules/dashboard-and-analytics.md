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
| GET    | `/overview` | `range` = `7`, `30` (default) or `90` days        | KPIs (organizations, members, active sessions, pending invitations, audit events and critical alerts in the last day), trend series (organization sign-ups and more), plan distribution |
| GET    | `/activity` | `range`, `page`, `pageSize`, `action`, `severity` | Recent audit entries for the feed                                                                                                                                                       |

Results are cached per range in Redis when it is configured; `invalidate(range, scope)` clears them.

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

- **The dashboard is platform-wide.** Counts and the activity feed are not filtered by organization, so a tenant user with `dashboard:read` sees every organization's members, sessions and audit entries (review **H5**). Either scope it to `req.tenantId` or reserve it for platform operators.
- Analytics events are posted with the user's token, so only signed-in usage is measured; that matches the stated purpose.
