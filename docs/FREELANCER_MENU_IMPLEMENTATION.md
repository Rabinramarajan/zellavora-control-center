# Freelancer Menu — Full Implementation Reference

Covers the **Freelancer** navigation group and its four children end to end: menu wiring, database, backend API, and frontend.

| Menu key | Label | Route | Backend module | Primary tables |
|---|---|---|---|---|
| `freelancer` | Freelancer (group) | — | `services/auth/menu.service.ts`, `modules/menu-access` | `resources`, `permissions` |
| `daily-sheets` | Daily Sheets | `/freelancer-sheets/daily` | `modules/daily-sheets` | `daily_sheets`, `daily_sheet_line_items` |
| `monthly-sheets` | Monthly Sheets | `/freelancer-sheets/monthly` | `modules/monthly-sheets` | `monthly_sheets` |
| `timesheets` | Timesheets | `/timesheets` | `modules/timesheets` | `timesheets`, `timesheet_entries` |
| `approval-queue` | Approval Queue | `/freelancer-sheets/approval` | `daily-sheets` + `monthly-sheets` (review endpoints) | same as above |

Related docs: [modules/freelancer-sheets.md](modules/freelancer-sheets.md), [modules/timesheets.md](modules/timesheets.md), [FREELANCER_SHEETS_IMPLEMENTATION.md](FREELANCER_SHEETS_IMPLEMENTATION.md), [TIMESHEET_MODULE.md](TIMESHEET_MODULE.md).

---

## 1. Menu & Access Control

### 1.1 Menu tree

The tree is defined server-side in `apps/backend/src/services/auth/menu.service.ts` and returned to the frontend sidebar. The group node (`key: "freelancer"`, `route: null`, `orderIndex: 7`) has no page of its own; it only expands to its children, ordered by `orderIndex` (1–4).

### 1.2 Visibility rules

There are two layers. Both must pass for an item to appear and work.

1. **Menu visibility (navigation permission).** The group is gated by the permission `navigation:freelancer` (resource `navigation`, action `freelancer`). Granting it shows the group and all of its children. The legacy key `navigation:freelancer-sheets` is retired and removed by the seed.
2. **Per-role menu restriction.** `modules/menu-access` stores a role's allowed menu keys (`{ restricted: true, keys: ["freelancer", ...] }`). These are **menu keys**, not permission keys. A restricted role sees only the listed nodes.
3. **Action permissions (enforced on API + routes).**

| Permission | Grants | Enforced at |
|---|---|---|
| *(authenticated)* | Own daily/monthly sheets and timesheets: create, edit while editable, submit, delete draft | `authGuard` on every route |
| `timesheet:approve` | View team scope; approve/reject daily, monthly, timesheets; bulk approve; mark monthly paid | `requirePermission(REVIEW_PERMISSION)` backend; `permissionGuard('timesheet:approve')` on `/freelancer-sheets/approval` |

`REVIEW_PERMISSION` is exported from `modules/timesheets/timesheets.rules.ts` and reused by both sheet modules, so all three share one reviewer permission.

### 1.3 Seeding

```bash
npm run db:seed:freelancer --workspace apps/backend   # apps/backend/src/db/seed-freelancer-user.ts
```

Creates/updates a `freelancer` user per organization, the `navigation:freelancer` permission, an org-scoped `<orgId>_freelancer` role holding it, and deletes retired permission keys.

---

## 2. Database (PostgreSQL / Prisma)

Schema: `apps/backend/prisma/schema.prisma`. Every table is scoped by `organization_id` (cascade delete) and owned by `user_id`. Sheet tables carry the standard audit columns `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at` (soft delete).

### 2.1 ER overview

```
organizations 1─* daily_sheets 1─* daily_sheet_line_items
organizations 1─* monthly_sheets      (daily_sheet_ids uuid[] → daily_sheets)
organizations 1─* timesheets 1─* timesheet_entries
users 1─* daily_sheets / monthly_sheets / timesheets   (owner: user_id)
users 1─* ... (approver: approved_by)
```

### 2.2 `daily_sheets`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `organization_id`, `user_id` | uuid FK | tenant + owner |
| `project_id` / `project_name` | uuid? / varchar(200)? | free-text project allowed |
| `sheet_date` | date | |
| `entry_type` | varchar(16), default `work` | `work` \| `leave` \| `holiday` |
| `start_time`, `end_time` | varchar(5) `HH:mm` | |
| `break_minutes` | int, default 0 | |
| `hours_worked` | decimal(5,2) | |
| `hourly_rate` | decimal(10,2) | |
| `total_amount` | decimal(12,2) | computed server-side |
| `is_billable` | bool, default true | |
| `description`, `tasks_completed`, `notes` | text? | |
| `status` | text, default `draft` | `draft` → `submitted` → `approved` \| `rejected` |
| `submitted_at`, `approved_at` | timestamptz? | |
| `approved_by` | uuid? FK users | |
| `rejection_reason` | text? | required when rejecting |

Indexes: `(organization_id, sheet_date)`, `(organization_id)`, `(user_id, sheet_date DESC)`, `(status)`.

### 2.3 `daily_sheet_line_items`

`id`, `daily_sheet_id` (FK, cascade), `task_name`, `description?`, `hours decimal(5,2)`, `rate decimal(10,2)?`, `amount decimal(12,2)`, `status` (default `active`), timestamps. Index on `daily_sheet_id`.

### 2.4 `monthly_sheets`

| Column | Type | Notes |
|---|---|---|
| `month`, `year` | int | **unique** `(user_id, month, year, organization_id)` |
| `total_hours` | decimal(7,2) | rolled up from approved dailies |
| `total_amount` | decimal(12,2) | |
| `average_hourly_rate` | decimal(10,2) | |
| `working_days` | int | |
| `daily_sheet_ids` | uuid[] | snapshot of included daily sheets |
| `status` | text, default `draft` | `draft` → `submitted` → `approved` → `paid`; `rejected` |
| `submitted_at`, `approved_at`, `paid_at` | timestamptz? | |
| `approved_by`, `rejection_reason` | | |

Indexes: `(organization_id)`, `(user_id, year, month DESC)`, `(status)`.

### 2.5 `timesheets` / `timesheet_entries`

`timesheets`: `period varchar(7)` (`YYYY-MM`, **unique** per `(user_id, period, organization_id)`), `status TimesheetStatus` (`DRAFT|SUBMITTED|APPROVED|REJECTED`), `employee_name?`, `department?` (override profile values on exports), `total_hours decimal(7,2)`, `submitted_at`, `approved_by`, `approved_at`, `rejected_at`, `rejection_reason`. Indexes: `(organization_id, period)`, `(organization_id, status)`.

`timesheet_entries`: one row per day — `entry_date date` (**unique** with `timesheet_id`), `day_of_week`, `start_time`/`end_time varchar(8)`, `hours decimal(5,2)?`, `status TimesheetEntryStatus` (`EMPTY|WORKING|EXTENDED|WEEKEND_WORK|LEAVE|HOLIDAY`), `notes`. `LEAVE`/`HOLIDAY` carry no hours.

### 2.6 Migrations

```bash
cd apps/backend
npx prisma migrate dev --name <change>
npx prisma generate
```

---

## 3. Backend (Express, `apps/backend/src/modules`)

Mounted in `apps/backend/src/routes/index.ts`:

```ts
app.use('/api/v1/daily-sheets', dailySheetsRoutes);
app.use('/api/v1/monthly-sheets', monthlySheetsRoutes);
app.use('/api/v1/timesheets', timesheetsRoutes);
```

Layering per module: `*.routes.ts` (auth + Zod validation) → `*.controller.ts` → `*.service.ts` (rules, tenancy) → Prisma (`timesheets.repository.ts` for timesheets). Errors are thrown as `AppError(message, status, code)` and handled by the central error middleware.

### 3.1 Daily Sheets — `/api/v1/daily-sheets`

| Method | Path | Guard | Purpose |
|---|---|---|---|
| POST | `/` | auth | Create sheet (+ line items) |
| GET | `/` | auth | List; `scope=mine\|team` (team needs reviewer), `status`, date filters, paging |
| GET | `/projects` | auth | Distinct project names for pickers |
| GET | `/:id` | auth | Get one (owner or reviewer) |
| PUT | `/:id` | auth | Update — only while `draft`/`rejected` |
| POST | `/:id/submit` | auth | `draft`/`rejected` → `submitted` |
| POST | `/:id/approve` | `timesheet:approve` | Body `{ approved: boolean, rejectionReason? }` (reason required when `approved=false`) |
| POST | `/bulk-approve` | `timesheet:approve` | Approve many from the queue |
| DELETE | `/:id` | auth | Soft-delete own editable sheet |

DTO highlights (`daily-sheets.dto.ts`): `entryType ∈ ['work','leave','holiday']`; line items `{ taskName, description?, hours, rate? }`; query `scope` default `mine`.

Rules (`sheets.shared.ts`):
- `EDITABLE_SHEET_STATUSES = ['draft','rejected']`; editing a locked sheet → `409 SHEET_LOCKED`.
- Only the owner edits/submits; reviewers decide.
- `total_amount` = hours × rate (or sum of line-item amounts), computed server-side — never trusted from the client.

### 3.2 Monthly Sheets — `/api/v1/monthly-sheets`

| Method | Path | Guard | Purpose |
|---|---|---|---|
| POST | `/` | auth | Generate month `{ month, year }` from the owner's **approved** daily sheets (upsert per unique key) |
| GET | `/` | auth | List; `scope`, `status ∈ draft\|submitted\|approved\|paid\|rejected` |
| GET | `/document` | auth | Printable monthly document (`monthly-sheets.document.ts`) |
| GET | `/:id` | auth | Get one |
| PUT | `/:id` | auth | Refresh: re-reads approved dailies (body is empty, schema `.strict()`) |
| POST | `/:id/submit` | auth | → `submitted` |
| POST | `/:id/approve` | `timesheet:approve` | Approve / reject with reason |
| POST | `/:id/mark-paid` | `timesheet:approve` | `approved` → `paid`, sets `paid_at` |
| DELETE | `/:id` | auth | Soft delete while editable |

Rollup: `total_hours = Σ hours_worked`, `total_amount = Σ total_amount`, `average_hourly_rate = total_amount / total_hours`, `working_days = count(entry_type = 'work')`, `daily_sheet_ids` = included IDs. Regenerating resets approval fields.

### 3.3 Timesheets — `/api/v1/timesheets`

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | `/` | auth | List; filters `employeeId?`, `year?`, `status?` |
| GET | `/summary` | auth | Yearly summary; `year`, `employeeId?` |
| GET | `/:id` | auth | Get sheet; `GET /?period=YYYY-MM` gets-or-creates the month with calendar rows (`timesheets.calendar.ts`) |
| GET | `/:id/export` | auth | `format=json\|csv\|html` (`timesheets.export.ts`) |
| POST | `/:id/entries/bulk` | auth | Upsert many days `{ entries: [{ date, ...patch }] }` |
| POST | `/:id/import` | auth | `{ format: csv\|json, sourceFormat?: csv\|json\|xlsx\|docx\|pdf, ... }` — frontend converts xlsx/docx/pdf to CSV first |
| PATCH | `/:id` | auth | Header fields (`employeeName`, `department`) |
| PATCH | `/:id/entries/:entryId` | auth | Edit one day |
| POST | `/:id/submit` | auth | `DRAFT`/`REJECTED` → `SUBMITTED` |
| POST | `/:id/approve` | `timesheet:approve` | → `APPROVED` |
| POST | `/:id/reject` | `timesheet:approve` | → `REJECTED` with reason (reopens editing) |

Rules (`timesheets.rules.ts`): only the owner edits entries (`403 NOT_SHEET_OWNER`), only while `DRAFT`/`REJECTED` (`409 TIMESHEET_LOCKED`); `LEAVE`/`HOLIDAY` force `hours = null`; `total_hours` recomputed on every entry write.

### 3.4 Shared status machine

```
          submit            approve
 draft ───────────▶ submitted ───────▶ approved ──(monthly only: mark-paid)──▶ paid
   ▲                    │
   │   edit & resubmit  │ reject (reason required)
   └──── rejected ◀─────┘
```

Every transition stamps `updated_by`. Auto-approvals, reopens and approval-mode changes are written to `audit_logs`.

### 3.5 Approval modes (`modules/approval-mode`)

Sign-off is a mode, not a fixed rule. The statuses above don't change; only the approve step does.

- **Storage:** `organizations.approval_mode` (`ApprovalMode`, default `EXTERNAL`) plus a per-member override `organization_members.approval_mode` (nullable). The mode in effect is the member override if set, otherwise the org mode. It is always the **sheet owner's** mode, never the reviewer's.
- **Why per member:** individual signups join the shared `zellavora-inc` org, so an org-only setting can't single them out. The migration `20261005170000_sheet_approval_mode` and new individual registrations set their membership to `NONE`.

| Mode | Submit | Approve / reject | Own sheet | Mark paid (monthly) | Reopen approved → draft |
|---|---|---|---|---|---|
| `NONE` | auto-approves in the same write | `409 APPROVAL_DISABLED` | — | owner | owner |
| `SELF` | → `submitted` | holder of `timesheet:approve` | allowed | reviewer, incl. owner | owner |
| `EXTERNAL` | → `submitted` | holder of `timesheet:approve` | `403 SELF_REVIEW_FORBIDDEN` | reviewer, not owner | `409 REOPEN_NOT_ALLOWED` |

Reopen needs `{ reason }`, refuses paid sheets (`SHEET_PAID`), and refuses a daily sheet already counted in a submitted, approved or paid month (`SHEET_IN_MONTH`). Reopen the month first.

New endpoints:

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | `/api/v1/approval-mode` | auth | `{ organizationMode, memberMode, effectiveMode }` for the caller |
| PUT | `/api/v1/approval-mode` | `settings:manage` | Set org mode; switching to `NONE` is refused with `409 APPROVAL_QUEUE_NOT_EMPTY` while affected sheets are `submitted` |
| PUT | `/api/v1/approval-mode/members/:userId` | `users:manage` | Set or clear (`null`) a member override; same pending-queue check |
| POST | `/daily-sheets/:id/reopen`, `/monthly-sheets/:id/reopen`, `/timesheets/:id/reopen` | auth (owner) | Approved → draft |
| POST | `/daily-sheets/submit-all` | auth | `{ startDate, endDate }`: submits (or finalizes) the caller's draft and rejected sheets in range |

`POST /monthly-sheets/:id/mark-paid` no longer requires `timesheet:approve` at the route; the service applies the table above.

`GET /auth/me` returns `approval: { organizationMode, memberMode, effectiveMode, reviewQueue }`. The Approval Queue menu node is hidden when `reviewQueue` is false, i.e. the org mode and the caller's own mode are both `NONE`.

### 3.6 Tests

`daily-sheets.service.spec.ts`, `monthly-sheets.service.spec.ts`, `monthly-sheets.document.spec.ts`, `timesheets.{service,rules,calendar,import}.spec.ts`, `approval-mode.rules.spec.ts`. Run with `npm run test:backend`.

---

## 4. Frontend (Angular 22, standalone, signals, OnPush)

### 4.1 Routing

`app.routes.ts` lazy-loads two features:

```ts
{ path: 'freelancer-sheets', canActivate: [authGuard], loadChildren: () => import('./features/freelancer-sheets/freelancer-sheets.routes').then(m => m.freelancerSheetsRoutes) },
{ path: 'timesheets',        canActivate: [authGuard], loadChildren: () => import('./features/timesheet/timesheet.routes').then(m => m.timesheetRoutes) },
```

`freelancer-sheets.routes.ts`:

| Path | Component | Guard |
|---|---|---|
| `daily` | `DailySheetsComponent` (list) | auth |
| `daily/new`, `daily/:id/edit`, `daily/:id` | `DailySheetFormComponent` | auth |
| `monthly` | `MonthlySheetsComponent` | auth |
| `monthly/timesheet` | `MonthlyTimesheetComponent` | auth |
| `approval` | `ApprovalQueueComponent` | `permissionGuard('timesheet:approve')`, `reviewQueueGuard` (redirects to `daily` when there is nothing to review) |
| `''` | redirect → `daily` | |

`timesheet.routes.ts`: `''` → list, `:period` → grid for `YYYY-MM`.

### 4.2 Feature layout

```
features/freelancer-sheets/
├── pages/
│   ├── daily-sheets/          # list, filters, status chips
│   ├── daily-sheet-form/      # create/edit/view, line items, time picker
│   ├── monthly-sheets/        # generate/refresh, submit, document
│   ├── monthly-timesheet/
│   └── approval-queue/        # reviewer inbox (daily + monthly tabs)
├── components/timesheet-import-dialog/
├── import/timesheet-pdf.ts
├── sheets.api.ts              # typed HttpClient calls
├── sheets.store.ts            # signal store
├── sheets.models.ts
├── sheets.presentation.ts     # status labels/colours
├── sheets.preferences.ts      # per-user UI prefs
└── sheets.time.ts             # HH:mm math, break handling

features/timesheet/
├── components/ (timesheet-list, timesheet-grid, timesheet-summary-card,
│               timesheet-approval-panel, timesheet-report-preview)
├── data/ (timesheet.service, timesheet.model, timesheet-import*,
│          timesheet-export.service, timesheet-report*, )
├── pipes/day-status.pipe.ts
└── timesheet.routes.ts
```

### 4.3 State pattern

`SheetsStore` holds `signal()` state (lists, filters, loading, error) and exposes `computed()` views; components inject it and never call `HttpClient` directly. Mutations call `sheets.api.ts`, then patch the store. Example from the approval queue:

```ts
tab = signal<QueueTab>('daily');
pendingDaily = computed(() => store.daily().filter(s => s.status === 'submitted'));
filteredDaily = computed(() => applyFilters(this.pendingDaily(), this.filters()));
selectedDaily = signal<readonly DailyRow[]>([]);
```

### 4.4 Screens

**Daily Sheets** — table of own sheets (date, project, type, hours, amount, status); filters by status/date/project; "New sheet" → form. Form: date, entry type, project (autocomplete from `/projects`), start/end time + break → hours computed live, rate, billable, line items, notes. Inputs disabled when status ∉ editable; rejection reason banner on rejected sheets. Actions: Save draft, Submit, Delete.

**Monthly Sheets** — month/year picker; Generate/Refresh from approved dailies; totals card (hours, amount, avg rate, working days); Submit; open printable document. Paid badge when `paid_at` set.

**Timesheets** — list of periods with status and totals; grid per `YYYY-MM` with one row per day (day status pipe, start/end, hours, notes), bulk edit, import dialog (CSV/JSON/XLSX/DOCX/PDF → CSV), export (CSV/HTML/PDF preview), editable employee name/department, Submit. Reviewers get the approval panel (approve / reject with reason).

**Approval Queue** — reviewer-only. Tabs: Daily / Monthly. Grouped by member, filters (project, member, date), sort, pagination, multi-select bulk approve (`/daily-sheets/bulk-approve`), per-row approve/reject with mandatory reason dialog, mark monthly as paid. Rows show a busy state while their request is in flight. Your own sheets appear as reviewable only in `SELF` mode, and approving one asks for confirmation first.

**Approval-mode UI** — `AuthStore.approval()` / `approvalMode()` signals, filled from `/auth/me`. Copy comes from `approvalCopy()` in `sheets.presentation.ts`. In `NONE` the submit button reads **Finalize**, approved shows as **Finalized**, the pending/rejected filters are dropped, and the owner gets **Reopen** (reason prompt, `sheets.reopen.ts`) and **Mark as paid**. `SELF` keeps **Submit** and adds **Reopen**. The timesheet approval panel is shown on your own sheet only in `SELF` mode. **Finalize all drafts** / **Submit all drafts** on Daily Sheets calls `submit-all` for the selected month.

### 4.5 UX & quality requirements

- Mobile-first; tables collapse to cards below `md`; 44×44 px touch targets.
- Full keyboard support, labelled controls, status conveyed by text not colour alone (WCAG 2.2 AA).
- Dark/light via CSS variables.
- Global HTTP error interceptor surfaces `SHEET_LOCKED` / `TIMESHEET_LOCKED` / `NOT_SHEET_OWNER` as readable toasts.

---

## 5. End-to-end flows

1. **Freelancer logs a day** → `POST /daily-sheets` (draft) → `POST /:id/submit`.
2. **Reviewer decides** in Approval Queue → `POST /daily-sheets/:id/approve { approved }` or bulk-approve.
3. **Month close** → freelancer `POST /monthly-sheets { month, year }` (pulls approved dailies) → submit → reviewer approves → `mark-paid`.
4. **Timesheet** (attendance-style, per period) → open `/timesheets/YYYY-MM` → fill/import days → submit → reviewer approves/rejects from the timesheet approval panel.

## 6. Known gaps / next steps

- Timesheet approvals live in the timesheet approval panel, not the Approval Queue tabs. Adding a third "Timesheets" tab (backed by `GET /timesheets?status=SUBMITTED`) would make the queue the single reviewer inbox.
- `daily_sheets.project_id` / `monthly_sheets.project_id` have no FK to `projects` yet; adding one requires backfilling or nulling orphan values first.
- Monthly status is a free `text` column while timesheets use a Postgres enum; migrating sheets to enums would enforce valid values at the DB level.
