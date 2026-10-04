# Freelancer sheets (daily and monthly)

Freelancers and staff log each day's work as a **daily sheet** (project, tasks with times, or a leave/holiday day). Reviewers approve daily sheets; approved days roll up into a **monthly sheet** that is approved and then marked as paid. A printable monthly timesheet mirrors the paper form the team signs.

## Code

| Layer          | Path                                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Daily sheets   | `apps/backend/src/modules/daily-sheets/` (`daily-sheets.service.ts`, `daily-sheets.controller.ts`, `daily-sheets.dto.ts`, `sheets.shared.ts` for viewer and permission rules)                                                  |
| Monthly sheets | `apps/backend/src/modules/monthly-sheets/` (`monthly-sheets.service.ts`, `monthly-sheets.document.ts` for the printable layout)                                                                                                |
| Frontend       | `apps/zcc-frontend/src/app/features/freelancer-sheets/` (pages: `daily-sheets`, `daily-sheet-form`, `monthly-sheets`, `monthly-timesheet`, `approval-queue`; `components/timesheet-import-dialog`; `styles/sheets-theme.scss`) |

## Who can do what

`sheets.shared.ts` holds the rules, using `timesheet:approve` as the reviewer permission:

| Actor                           | Can                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Any signed-in member            | Create, edit, submit and delete **their own** draft sheets; see their own sheets                          |
| Reviewer (`timesheet:approve`)  | See the team's sheets, create sheets on someone's behalf, approve, bulk-approve, mark monthly sheets paid |
| Reviewer on their **own** sheet | Blocked, unless their organization role is `owner`                                                        |

Requests for another user's data without the reviewer permission return 403.

## Daily sheets API

Base path `/api/v1/daily-sheets`; the router requires sign-in.

| Method             | Path            | Guard               | Purpose                                                                                          |
| ------------------ | --------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| GET                | `/`             | signed in           | List (own, or team scope for reviewers), filter by date, status, user                            |
| GET                | `/projects`     | signed in           | Project name suggestions from the user's history                                                 |
| POST               | `/`             | signed in           | Create: date, entry type `work` / `leave` / `holiday`, line items with start/end times and hours |
| GET / PUT / DELETE | `/:id`          | owner or reviewer   | Read, update, delete                                                                             |
| POST               | `/:id/submit`   | owner               | Draft → submitted                                                                                |
| POST               | `/:id/approve`  | `timesheet:approve` | Submitted → approved                                                                             |
| POST               | `/bulk-approve` | `timesheet:approve` | Approve many                                                                                     |

Rules: a day can hold one absence or several work sheets but not both (`DAY_IS_ABSENCE`, `DAY_ALREADY_LOGGED`); switching a sheet to leave drops its tasks; validation failures return 400 with field errors. Statuses: `draft`, `submitted`, `approved`, `rejected`.

## Monthly sheets API

Base path `/api/v1/monthly-sheets`; the router requires sign-in.

| Method             | Path             | Guard               | Purpose                                                                        |
| ------------------ | ---------------- | ------------------- | ------------------------------------------------------------------------------ |
| GET                | `/`              | signed in           | List months                                                                    |
| GET                | `/document`      | signed in           | Printable timesheet for a user and month (built from daily sheets)             |
| POST               | `/`              | signed in           | Create the month from that month's **approved** daily sheets (totals computed) |
| GET / PUT / DELETE | `/:id`           | owner or reviewer   | Read, update, delete                                                           |
| POST               | `/:id/submit`    | owner               | Submit                                                                         |
| POST               | `/:id/approve`   | `timesheet:approve` | Approve                                                                        |
| POST               | `/:id/mark-paid` | `timesheet:approve` | Approved → paid (refused otherwise, `SHEET_NOT_APPROVED`)                      |

One monthly sheet per user, month, year and organization; a deleted month is revived in place.

## Data model

`DailySheet` (user, organization, `sheetDate`, `entryType`, hours, project name, status, approval stamps, `createdBy`), `DailySheetLineItem` (task, start/end time, hours), `MonthlySheet` (user, month, year, total hours, status, approval and payment stamps), `Project`.

## Frontend

| Route                                                           | Screen                                       |
| --------------------------------------------------------------- | -------------------------------------------- |
| `/freelancer-sheets/daily`, `/daily/list`                       | Daily sheet calendar and list                |
| `/freelancer-sheets/daily/new`, `/daily/:id/edit`, `/daily/:id` | Daily sheet form with line items and times   |
| `/freelancer-sheets/monthly`, `/monthly/list`                   | Monthly sheets                               |
| `/freelancer-sheets/monthly/timesheet`                          | Printable monthly timesheet                  |
| `/freelancer-sheets/approval`                                   | Approval queue with bulk approve (reviewers) |

The import dialog brings in timesheet rows from a file; PDF output uses the lazy `pdf` chunk.

## Tests

`daily-sheets.service.spec.ts`, `monthly-sheets.service.spec.ts`, `monthly-sheets.document.spec.ts`, and three frontend specs under `features/freelancer-sheets`.

## Review notes

- Ownership and review rules are centralised and tested; a good pattern for other modules.
- `rejected` exists in the schema, but there is no reject endpoint for daily or monthly sheets; reviewers can only approve (review **L9**). A reviewer who disagrees has to ask the owner to edit, with no recorded reason.
- This module overlaps with [timesheets](timesheets.md): both record hours per user per month with approval. Decide which is the product.

## Related

[FREELANCER_SHEETS_IMPLEMENTATION.md](../FREELANCER_SHEETS_IMPLEMENTATION.md) (note: `IMPLEMENTATION_SUMMARY.md` describes an earlier state)
