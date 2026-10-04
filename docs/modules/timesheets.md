# Timesheets (monthly grid)

One timesheet per employee per calendar month (`YYYY-MM`), edited as a grid with one row per day, then submitted, approved or rejected, and exported. The employee is a `User`.

## Code

| Layer    | Path                                                                                                                                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend  | `apps/backend/src/modules/timesheets/` (`timesheets.service.ts`, `.repository.ts`, `.controller.ts`, `.dto.ts`, `.rules.ts` for permissions and transitions, `.calendar.ts` for month generation, `.export.ts` for JSON/CSV/HTML) |
| Frontend | `apps/zcc-frontend/src/app/features/timesheet/` (`timesheet-list`, `timesheet-grid`, `timesheet-summary-card`, `timesheet-approval-panel`)                                                                                        |

## API

Base path `/api/v1/timesheets`; the router requires sign-in.

| Method | Path                                 | Guard                 | Purpose                                                                      |
| ------ | ------------------------------------ | --------------------- | ---------------------------------------------------------------------------- |
| GET    | `/?employeeId&period=YYYY-MM`        | owner or reviewer     | The month's sheet; creates a draft with a blank entry per day if none exists |
| GET    | `/?employeeId&year&status`           | owner or reviewer     | List sheets (no `period`)                                                    |
| GET    | `/summary?employeeId&year`           | owner or reviewer     | Yearly roll-up                                                               |
| GET    | `/:id`                               | owner or reviewer     | Sheet with entries                                                           |
| GET    | `/:id/export?format=json\|csv\|html` | owner or reviewer     | Download                                                                     |
| POST   | `/:id/entries/bulk`                  | owner, while editable | Upsert up to 31 entries                                                      |
| PATCH  | `/:id/entries/:entryId`              | owner, while editable | Update one entry                                                             |
| POST   | `/:id/submit`                        | owner                 | Draft or rejected → submitted                                                |
| POST   | `/:id/approve`                       | `timesheet:approve`   | Submitted → approved                                                         |
| POST   | `/:id/reject`                        | `timesheet:approve`   | Submitted → rejected, with a reason                                          |

## Rules (`timesheets.rules.ts`)

- Transitions: `DRAFT → SUBMITTED`, `SUBMITTED → APPROVED | REJECTED`, `REJECTED → SUBMITTED`. `APPROVED` is final.
- Only the owner edits entries, and only in `DRAFT` or `REJECTED`. A manager who wants changes rejects the sheet.
- Rejecting clears approval stamps; resubmitting clears the rejection.
- Hours 0–24 per day. `LEAVE` and `HOLIDAY` clear hours and times.
- `total_hours` is recalculated from entries in the same transaction.
- The organization always comes from the token. Uniqueness is `(userId, period, organizationId)`.

Entry statuses: `EMPTY`, `WORKING`, `EXTENDED`, `WEEKEND_WORK`, `LEAVE`, `HOLIDAY`.

## Data model

`Timesheet` (user, organization, period, `TimesheetStatus`, total hours, approval/rejection stamps), `TimesheetEntry` (date, start/end, hours, `TimesheetEntryStatus`, notes).

## Frontend

| Route                 | Screen                                                      |
| --------------------- | ----------------------------------------------------------- |
| `/timesheets`         | List of months with summary cards                           |
| `/timesheets/:period` | Editable grid, totals, submit; approval panel for reviewers |

## Tests

`timesheets.service.spec.ts`, `timesheets.rules.spec.ts`, `timesheets.calendar.spec.ts`, and two frontend specs.

## Review notes

- Well-structured and tested.
- Overlaps with [freelancer sheets](freelancer-sheets.md): both produce an approved monthly record of hours per user. They share the `timesheet:approve` permission but not data. Pick one, or define how they relate (for example, generate the grid from approved daily sheets).
- `docs/TIMESHEET_MODULE.md` still points at `apps/admin/...`; the frontend lives in `apps/zcc-frontend/src/app/features/timesheet/`.

## Related

[TIMESHEET_MODULE.md](../TIMESHEET_MODULE.md)
