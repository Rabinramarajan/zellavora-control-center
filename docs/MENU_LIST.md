# ZCC Sidebar Menu List

The sidebar is backend-driven. `GET /auth/me` returns the menu tree built from
`DEFAULT_MENU` in `apps/backend/src/services/auth/menu.service.ts`, filtered by
the user's permissions. The frontend renders it in
`apps/zcc-frontend/src/app/shared/components/sidebar/sidebar.component.ts`.

## Visibility Rules

- An item with a **Required Permission** is hidden unless the user holds that permission.
- Users with `navigation:restricted` only see items explicitly granted via
  `navigation:<menu-key>` (e.g. `navigation:dashboard`). Children of a granted
  item are shown automatically, still subject to their own required permission.
- The Owner role (`all:all`) sees everything.

## Full Menu Tree

Group headers (route `—`) have no page of their own and are hidden when none of
their children are visible to the user.

| # | Icon | Label | Route | Key | Required Permission |
|---|------|-------|-------|-----|---------------------|
| 1 | 📊 | Dashboard | `/dashboard` | `dashboard` | `dashboard:read` |
| 2 | 🎨 | Portfolio | `/portfolio` | `portfolio` | — |
| 2.1 | 👤 | ↳ Profile | `/portfolio/profile` | `portfolio-profile` | — |
| 2.2 | 🌟 | ↳ Hero | `/portfolio/hero` | `portfolio-hero` | — |
| 2.3 | 📝 | ↳ About | `/portfolio/about` | `portfolio-about` | — |
| 2.4 | 🧠 | ↳ Skills | `/portfolio/skills` | `portfolio-skills` | — |
| 2.5 | 💼 | ↳ Experience | `/portfolio/experience` | `portfolio-experience` | — |
| 2.6 | 🎓 | ↳ Education | `/portfolio/education` | `portfolio-education` | — |
| 2.7 | 🛠️ | ↳ Services | `/portfolio/services` | `portfolio-services` | — |
| 2.8 | 💬 | ↳ Testimonials | `/portfolio/testimonials` | `portfolio-testimonials` | — |
| 3 | 🗂️ | Projects | `/projects` | `projects` | — |
| 4 | 📝 | Content | — | `content` | — |
| 4.1 | ✍️ | ↳ Blog / Insights | `/blog` | `blog` | — |
| 4.2 | 🖼️ | ↳ Media Library | `/media` | `media` | — |
| 4.3 | 🧱 | ↳ CMS Builder | `/cms-builder` | `cms-builder` | — |
| 5 | 🖌️ | Appearance | — | `appearance` | — |
| 5.1 | 🎛️ | ↳ Theme Builder | `/theme-builder` | `theme-builder` | — |
| 6 | 📈 | Analytics | `/analytics` | `analytics` | — |
| 7 | 💼 | Freelancer | — | `freelancer` | — |
| 7.1 | 📅 | ↳ Daily Sheets | `/freelancer-sheets/daily` | `daily-sheets` | — |
| 7.2 | 📊 | ↳ Monthly Sheets | `/freelancer-sheets/monthly` | `monthly-sheets` | — |
| 7.3 | ⏱️ | ↳ Timesheets | `/timesheets` | `timesheets` | — |
| 7.4 | ✓ | ↳ Approval Queue | `/freelancer-sheets/approval` | `approval-queue` | `timesheet:approve` |
| 8 | 👥 | Identity & Access | — | `iam` | — |
| 8.1 | 🙍 | ↳ Users | `/iam/users` | `iam-users` | `users:read` |
| 8.2 | 👑 | ↳ Roles | `/iam/roles` | `iam-roles` | `roles:read` |
| 8.3 | 🔐 | ↳ Permissions | `/admin/roles` | `iam-permissions` | `roles:manage` |
| 8.4 | 🧑‍🤝‍🧑 | ↳ Groups | `/iam/groups` | `iam-groups` | `groups:read` |
| 8.5 | 🧩 | ↳ Resources | `/iam/resources` | `iam-resources` | `resources:read` |
| 9 | 🏢 | Organization | — | `organization` | — |
| 9.1 | 🏬 | ↳ Branches | `/admin/branches` | `org-branches` | `users:manage` |
| 10 | 🔔 | Notifications | `/notifications` | `notifications` | — |
| 11 | 🛡️ | Operations | — | `operations` | — |
| 11.1 | 🧾 | ↳ Audit Logs | `/audit-logs` | `audit-logs` | `system:audit:read` |
| 11.2 | 🩺 | ↳ System Health | `/system-health` | `system-health` | `system:rbac:read` |
| 12 | ⚙️ | System | — | `system` | — |
| 12.1 | 🛠️ | ↳ General Settings | `/settings` | `settings` | `settings:manage` |

**Totals:** 12 top-level items, 25 sub-items (37 entries).

The separate top-level `Users` and `Admin` entries were removed; all user
administration lives under Identity & Access. The `/users` and `/admin/*` routes
still exist for deep links.

## Supabase Deployment Note

In the Supabase deployment the menu comes from the `menus` table instead
(seeded in `apps/backend/supabase/migrations/0023_dynamic_menu_fix.sql`), which
holds a smaller set: Dashboard, Projects, Settings, and Admin Console
(Manage Users, Manage Roles, Resources, Branches).
