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
| PATCH | `/timesheets/:id` | Set `employeeName` / `department` shown on the sheet (owner, while editable). Empty clears back to the profile. |
| GET | `/timesheets/:id/export?format=json\|csv\|html` | See *Exports*. |
| POST | `/timesheets/:id/entries/bulk` | Upsert up to 31 entries at once. |
| POST | `/timesheets/:id/import` | Import a CSV or JSON export. See *Imports*. |
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

## Sheet details and time entry

Each sheet stores its own `employeeName` and `department` (migration
`20261005150000_timesheet_employee_department`). Null falls back to the user
profile, in the grid and in exports. Both are edited at the top of the grid and
saved after a short pause, like cells.

The grid columns are Date, Day, Start Time, End Time, Hours and Status/Notes.
Start and End use the shared `app-time-picker`
(`shared/components/time-picker`): type ("930p", "21:30") or pick from a
15-minute list. When both times are set on a day with no hours, the hours are
filled in from the span and a blank status becomes Working or Weekend work.

## Export preview, PDF and Word

The grid's **Export** button opens a preview with **Download PDF**, **Download
Word**, **Print** and **CSV**.

- `buildTimesheetReport(sheet)` (`data/timesheet-report.ts`) computes everything
  shown: header (employee, department, period, total hours), daily rows, summary
  (working days, leave and holiday dates, total), work-schedule notes (regular
  hours, overtime above a configurable threshold, default 8 h, weekend work,
  leave) and warnings (missing start or end times, worked days without hours, a
  saved total that disagrees with the rows). Only the signature lines are blank.
- `TimesheetExportService` renders that report with jsPDF + jspdf-autotable and
  with `docx`. Both are imported on first use, so the initial bundle is unchanged.
  Files are named `Timesheet_<Employee>_<YYYY-MM>.pdf` or `.docx`.
- The preview and Print share one self-contained HTML document
  (`timesheet-report-html.ts`) shown in a sandboxed iframe without scripts. All
  values are escaped.
- Row shading is the same in all three: leave red, weekend work yellow, holidays
  blue, empty weekends grey.
- CSV still comes from `GET /timesheets/:id/export?format=csv` so it stays
  importable.

## Imports

`POST /timesheets/:id/import` takes `{ format: 'csv' | 'json', filename?, content }`,
where `content` is the text of a file the export endpoint produced (at most 1 MB).
`timesheets.import.ts` is the inverse of `timesheets.export.ts`:

- CSV needs the `Date, Start, End, Hours, Status, Notes` columns; `Day` is
  ignored. Status accepts the export labels (`Working`, `Weekend work`, `—`, …)
  or the enum values.
- JSON accepts the bare export model or the `{ success, data }` envelope. A
  file whose `period` differs from the sheet's is refused.
- Validation is all-or-nothing. Any bad row (date outside the period, a
  repeated date, an invalid time, hours outside 0–24, an unknown status, or
  notes over 2,000 characters) rejects the file with `422
  INVALID_TIMESHEET_IMPORT`, and `error.errors` lists one message per problem.
- Valid rows replace those days in one transaction and other days are left
  alone. The usual editing guards apply: only the owner can import, and only
  into a `DRAFT` or `REJECTED` sheet. Each import writes a `timesheet.imported`
  audit event.

The grid's **Import** dialog also accepts Excel (`.xlsx`), Word (`.docx`) and PDF
files, up to 10 MB. `timesheet-import-documents.ts` converts them to the canonical
CSV in the browser, so the server only ever validates CSV or JSON. `sourceFormat`
is recorded in the audit event.

- `.xlsx` and `.docx` are unzipped with `DecompressionStream` and read with
  `DOMParser`; no Office library is bundled. The first worksheet, or every Word
  table, is scanned for a header row with `Date` and `Hours` or `Status`
  (common aliases such as *Time in*, *Hrs* and *Remarks* are recognised). Excel
  date serials and time fractions are converted. Rows with hours but no status
  become *Working*, or *Weekend work* on a Saturday or Sunday.
- PDFs are read with the on-demand pdf.js loader from freelancer sheets. They
  can be the printable Zellavora export or one-row-per-day layouts
  ("Aug 3 Mon 9:00 AM …"). Scanned images contain no text and are refused.
- Legacy `.xls` and `.doc` files are refused with a "save as .xlsx/.docx" hint.

The dialog parses the file in the browser (`timesheet-import.ts`) for an instant
preview, then uploads the same text. The server's answer is
final. If it rejects the file, its messages replace the preview.

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
