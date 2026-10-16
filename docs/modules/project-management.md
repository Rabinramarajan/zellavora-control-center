# Project and task management

Delivery projects with a kanban board, tasks, subtasks, dependencies, milestones, comments, templates, progress and reports. It is **not** the portfolio showcase (`routes/projects.ts`, `/api/v1/projects`), which keeps its own tables and permissions.

## Code

| Layer | Location |
| ----- | -------- |
| Module | `apps/backend/src/modules/pm/` (`pm.dto.ts`, `pm.access.ts`, `pm.repository.ts`, `projects.service.ts`, `tasks.service.ts`, `templates.service.ts`, `pm.controller.ts`, `pm.routes.ts`) |
| Routes | `pm.routes.ts` is **generated** from the table in `scripts/gen-pm-routes.cjs` (route, permission and OpenAPI block together). Edit the table, run `node scripts/gen-pm-routes.cjs`. |
| Mounts | `/api/v1/pm` and `/api/app/pm` (the path the Nexus app uses) |
| Migration | `20261017000000_pm_projects_tasks` (tables, permissions, default grants) |
| Tests | `pm.spec.ts` (rules), `e2e/api.checks.mjs` section "projects and tasks" (about 80 checks against the real API and database), `e2e/migrations.check.mjs` |

## Data model

`PmProject` (key unique per organization, board `columns` JSON, `taskCounter`), `PmProjectMember` (PM_LEAD, CONTRIBUTOR, VIEWER), `PmMilestone`, `PmTask` (per-project `number`, `status` = a column key, `position`, `version`, recurrence), `PmTaskDependency`, `PmTaskComment`, `PmTaskActivity` (append-only), `PmTemplate`. User ids carry no foreign keys; the service checks organization membership.

## Rules

- **Two layers of access.** An organization permission says whether you may use a capability at all; the project role says on which project. Both must pass.
- **Visibility.** PRIVATE: members and the owner only, administrators included. TEAM: also members of the linked team. ORG: everyone with `pm:projects:read`. A project you cannot see answers 404, the same as one that does not exist.
- **Roles.** Owner is always PM_LEAD. Viewers read only. Contributors create and edit tasks and comment. Leads edit the project, milestones and members. Holders of `pm:projects:write` lead any project they can see.
- **Task numbers** come from `taskCounter`, incremented in the same statement that locks the project row, so parallel creates never collide. The key is `<PROJECT>-<number>`.
- **Concurrency.** Edits and moves carry the `version` you read; a stale one answers 409 `VERSION_CONFLICT` with the current version.
- **Ordering** uses a decimal `position`; placing between two cards takes the midpoint, and the column is renumbered when the gap gets too small.
- **Finishing.** A task cannot enter a done column while a blocker or a subtask is open (409 `BLOCKED_BY_DEPENDENCIES`, `OPEN_SUBTASKS`). Dependencies cannot loop, and subtasks are one level deep.
- **Progress** counts leaf tasks; a parent's progress is the share of its subtasks that are done.
- **Columns** that hold tasks cannot be removed, and cannot change whether they mean done.
- **Recurring tasks** (DAILY, WEEKLY, MONTHLY) create the next occurrence when completed. A conditional update on `recurrenceSpawnedAt` makes that happen once; reopening the task re-arms it.
- **Free text** (descriptions, comments) is stored as plain text with control characters removed. Clients must render it as text, never as HTML.
- Removing a member unassigns their tasks. Deleting a project soft-deletes its tasks and keeps its key reserved. Assignment and comments notify the assignee (in-app).

## Permissions

`pm:projects:read|write|manage-members|report`, `pm:tasks:read|write|comment`, `pm:templates:manage`. They are deliberately not `projects:*`, which guard the portfolio and technologies. The migration grants read and task permissions to every role holding `portfolio:read`, and write, members, report and templates to roles holding `settings:manage`.

## Endpoints (`/api/v1/pm`)

Projects: `GET/POST /projects`, `POST /projects/from-template`, `GET/PATCH/DELETE /projects/:id`, `GET /projects/:id/progress|report`, members `GET/POST /projects/:id/members`, `PATCH/DELETE .../members/:userId`, milestones `POST /projects/:id/milestones`, `PATCH/DELETE .../milestones/:mid`.
Tasks: `GET /projects/:id/board`, `GET /projects/:id/board/column`, `GET/POST /projects/:id/tasks`, `GET /my-tasks`, `POST /tasks/bulk`, `GET/PATCH/DELETE /tasks/:id`, `POST /tasks/:id/move`, `GET /tasks/:id/activity`, comments `GET/POST /tasks/:id/comments`, `PATCH/DELETE .../comments/:cid`, dependencies `POST /tasks/:id/dependencies`, `DELETE .../dependencies/:otherId`.
Templates: `GET/POST /templates`, `POST /templates/from-project/:projectId`, `GET/PATCH/DELETE /templates/:id`.

Lists answer `{ success, data, meta: { page, pageSize, total } }`.

## Attachments and time

- **Attachments** are stored in `PmTaskAttachment.data` (bytes in the database), at most 3 MB each and 20 per task. Upload is JSON `{ fileName, base64Data }` on `POST /tasks/:id/attachments` (that route alone accepts a 4.5 MB body). The type is decided from the bytes: PNG, JPEG, GIF, WebP, PDF (shown inline); text, CSV, JSON, Word, Excel, PowerPoint, ZIP (download only). SVG, HTML, executables and anything else answer 415, whatever the name says. Downloads send `nosniff` and `Content-Security-Policy: sandbox`. The uploader or a lead may delete; deleting empties the stored bytes.
- **Time** (`PmTimeEntry`): contributors and leads log hours (0.01 to 24) against a task and a day. No future dates, no more than 24 hours a day per person across tasks, not in archived projects. Only the author edits an entry; the author or a lead removes it. Task lists carry `loggedHours`; the report carries `hours.actual` and `timeByPerson`.
- Endpoints: `GET/POST /tasks/:id/attachments`, `GET .../attachments/:aid/download`, `DELETE .../attachments/:aid`, `GET/POST /tasks/:id/time`, `PATCH/DELETE .../time/:entryId`.
- Migration `20261017010000_pm_attachments_time`.

## Known limits

- Actual hours are not linked to timesheets (those are per day, not per task).
- A deleted project keeps its key reserved.
- Attachments live in the database, which suits a few small files per task; larger files need object storage.

## Frontend (Nexus app, `D:\personal_github\zelavora-nexus`, `src/app/features/delivery/`)

Menu group **Delivery** (Projects, My tasks, Templates; the backend menu supplies it) at `/delivery/*`. The existing **Projects** entry is still the portfolio showcase.

| Route | Component | Notes |
| ----- | --------- | ----- |
| `/delivery/projects` | `ProjectsListComponent` | search, status and "mine" filters, paging, create, from template |
| `/delivery/projects/:id/board` | `BoardComponent` | kanban with drag and drop (CDK), inline add, per-column paging, filters |
| `.../list` | `TaskListComponent` | filters, sort, paging, bulk move, priority and assignee |
| `.../milestones`, `.../members`, `.../report`, `.../settings` | one component each | settings has columns, archive, save as template, delete |
| `?task=<id>` on any project page | `TaskDrawerComponent` | edit, status, subtasks, dependencies, comments, activity; shareable link |
| `/delivery/my-tasks`, `/delivery/templates` | `MyTasksComponent`, `TemplatesComponent` | |

The drawer also holds **Files** (`task-files/task-attachments.component.ts`: pick, size check, base64 upload, download through a blob, remove) and **Time** (`task-time.component.ts`: log, edit, remove, total against the estimate). The task list has an Hours column and the report has logged hours and time by person.

**Rich text.** Descriptions and comments are written in a small Markdown subset (bold, italic, code, links, lists, quotes, headings, code blocks). `rich-text/rich-text.ts` parses it into a typed tree, `RichTextComponent` renders the tree with control flow (no `innerHTML`; only http, https and mailto links), and `RichEditorComponent` adds a toolbar and a preview. The server still stores the text as typed.

`PmApiService` is the typed client, `ProjectStore` holds the open project and board (optimistic card moves that reload the board when the server refuses). Styles are in `src/styles/_delivery.scss`. Unit tests: `services/project.store.spec.ts`, `delivery.helpers.spec.ts`, `rich-text/rich-text.spec.ts`, `task-files/files.helpers.spec.ts`.
