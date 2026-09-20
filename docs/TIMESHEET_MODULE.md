# Timesheet Module

Monthly timesheets with an editable grid, an approval flow, and exports.
One sheet per employee per calendar month, identified by a `YYYY-MM` period.

- Backend: `apps/backend/src/modules/timesheets/`
- Frontend: `apps/admin/src/app/features/timesheet/` (route `/timesheets`)

## Data model

Two tables, added to `apps/backend/prisma/schema.prisma`:

| Table | Purpose |
| --- | --- |
| `timesheets` | One row per employee per period. Carries status, approval stamps, and the denormalized `total_hours`. |
| `timesheet_entries` | One row per calendar day of the period. Start/end times, hours, status, notes. |

Enums: `TimesheetStatus` (`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`) and
`TimesheetEntryStatus` (`EMPTY`, `WORKING`, `EXTENDED`, `WEEKEND_WORK`,
`LEAVE`, `HOLIDAY`).

Two points worth knowing before you change anything:

- **The employee is a `User`.** This platform has no `Employee` model — the
  existing `DailySheet` and `MonthlySheet` tables both hang off `User`, and
  `Timesheet` follows them. API parameters are still named `employeeId`.
- **Uniqueness includes the tenant**: `@@unique([userId, period, organizationId])`,
  matching the pattern on `monthly_sheets`.

Apply the migration with:

```bash
cd apps/backend
npx prisma migrate dev --name add_timesheets
```

## API

Base path `/api/v1/timesheets`. Every route sits behind `authGuard`, and the
OpenAPI spec is generated from the `@swagger` blocks in
`timesheets.routes.ts` (visible at `/swagger`).

| Method | Route | Notes |
| --- | --- | --- |
| GET | `/timesheets?employeeId&period` | Returns the period's sheet, creating a draft with a full month of blank entries if none exists. |
| GET | `/timesheets?employeeId&year&status` | Without `period`, lists sheets. |
| GET | `/timesheets/summary?employeeId&year` | Yearly rollup for reports. |
| GET | `/timesheets/:id` | One sheet with its entries. |
| GET | `/timesheets/:id/export?format=json\|csv\|html` | See *Exports*. |
| POST | `/timesheets/:id/entries/bulk` | Upsert up to 31 entries at once. |
| PATCH | `/timesheets/:id/entries/:entryId` | Update one entry. |
| POST | `/timesheets/:id/submit` | Employee submits → `SUBMITTED`. |
| POST | `/timesheets/:id/approve` | Manager approves → `APPROVED`. |
| POST | `/timesheets/:id/reject` | Manager rejects with a reason → `REJECTED`. |

### Business rules

Enforced server-side in `timesheets.rules.ts` and `timesheets.service.ts`:

- Only the owning employee may edit entries, and only while the sheet is
  `DRAFT` or `REJECTED`. Ownership is checked before status, so a manager
  probing the endpoint cannot infer a sheet's state.
- Allowed transitions: `DRAFT → SUBMITTED`, `SUBMITTED → APPROVED | REJECTED`,
  `REJECTED → SUBMITTED`. Approval is terminal.
- Rejecting clears any prior approval; resubmitting clears the rejection.
- `hours` must be 0–24. `LEAVE` and `HOLIDAY` force `hours`, `startTime` and
  `endTime` to null, whichever order the fields arrive in.
- `total_hours` is recalculated from the entries inside the same transaction
  as the write that changed them, so the two cannot drift.
- The organization comes from the verified access token, never from the
  request body or query. Every repository read is keyed on it, so an id from
  another tenant simply returns nothing.

### Permissions

Approve and reject require `timesheet:approve` via `requirePermission`. The
frontend hides the approval panel with `*hasPermission="'timesheet:approve'"`,
which is a convenience — the server is the control.

This permission code is **not** seeded anywhere yet. Grant it to the manager
role in whichever org you are testing against, or the approval routes will
return 403 for everyone.

## Frontend

```
features/timesheet/
  timesheet.routes.ts          # lazy, provides MessageService for the feature
  data/timesheet.model.ts      # types mirroring the Prisma models
  data/timesheet.service.ts    # Resource API for reads, imperative mutations
  components/timesheet-list/             # period picker and status cards
  components/timesheet-grid/             # the editable month grid
  components/timesheet-summary-card/     # the four headline figures
  components/timesheet-approval-panel/   # manager-only approve / reject
  pipes/day-status.pipe.ts     # EntryStatus → label and colours
```

`TimesheetService` holds `period` and `employeeId` signals; the
`timesheetResource` refetches whenever either changes. `entries` and `totals`
are `computed`, so the totals bar and the summary card update from the same
derived value with no manual recalculation.

`updateEntry` patches the row optimistically, debounces the PATCH by 400 ms,
and restores the pre-edit row plus a toast if the save fails.

The app uses **PrimeNG and Tailwind**, not Angular Material, so the grid is a
plain table with Tailwind classes and `p-select` for the status column.

## Exports

`buildExportModel` produces one shape that all three formats render from:

- `json` — the sheet and its entries, for backup and integrations.
- `csv` — the grid, for spreadsheets.
- `html` — a print-ready document (info header, table, summary, signature
  blocks). Save as PDF from the browser's print dialog.

There is no server-side PDF renderer in this repo and no Reports module to
reuse. If one is added, render it from `buildExportModel` rather than
re-deriving the figures.

## Notifications

`TimesheetsService.notify` posts through the existing `NotificationService`:
submit notifies the approvers' queue (no single recipient), approve and
reject notify the employee. Failures are logged, never thrown — a
notification outage must not roll back an approval.

## Tests

```bash
cd apps/backend && npm test          # calendar, rules, service specs
cd apps/admin && npm test            # totals, patch semantics, pipe
cd apps/admin && npm run test:e2e    # needs the app and API running
```

The E2E suite (`apps/admin/e2e/timesheet.spec.ts`) fills a month, submits,
approves as a manager, and checks the grid locks. It reads credentials from
`E2E_EMPLOYEE_EMAIL` / `E2E_MANAGER_EMAIL` and friends, and the manager
account needs `timesheet:approve`.
