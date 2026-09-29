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
| 4 | ✍️ | Blog | `/blog` | `blog` | — |
| 5 | 🖼️ | Media | `/media` | `media` | — |
| 6 | 🧱 | CMS Builder | `/cms-builder` | `cms-builder` | — |
| 7 | 🎛️ | Theme Builder | `/theme-builder` | `theme-builder` | — |
| 8 | 📈 | Analytics | `/analytics` | `analytics` | — |
| 9 | 📋 | Freelancer Sheets | `/freelancer-sheets` | `freelancer-sheets` | — |
| 9.1 | 📅 | ↳ Daily Sheets | `/freelancer-sheets/daily` | `daily-sheets` | — |
| 9.2 | 📊 | ↳ Monthly Sheets | `/freelancer-sheets/monthly` | `monthly-sheets` | — |
| 9.3 | ✓ | ↳ Approval Queue | `/freelancer-sheets/approval` | `approval-queue` | `timesheet:approve` |
| 10 | ⏱️ | Timesheets | `/timesheets` | `timesheets` | — |
| 11 | 👥 | Users | `/users` | `users` | `users:read` |
| 12 | 🔑 | Identity & Access | `/iam` | `iam` | `system:rbac:read` |
| 12.1 | 🧩 | ↳ Resources | `/iam/resources` | `iam-resources` | `resources:read` |
| 12.2 | 👑 | ↳ Roles | `/iam/roles` | `iam-roles` | `roles:read` |
| 12.3 | 🧑‍🤝‍🧑 | ↳ Groups | `/iam/groups` | `iam-groups` | `groups:read` |
| 12.4 | 🙍 | ↳ Users | `/iam/users` | `iam-users` | `users:read` |
| 13 | 🛡️ | Admin | `/admin` | `admin` | `users:manage` |
| 13.1 | 👥 | ↳ Users | `/admin/users` | `admin-users` | `users:manage` |
| 13.2 | 🔐 | ↳ Roles & Permissions | `/admin/roles` | `admin-roles` | `roles:manage` |
| 13.3 | 🧩 | ↳ Resources | `/admin/resources` | `admin-resources` | `resources:manage` |
| 13.4 | 🏢 | ↳ Branches | `/admin/branches` | `admin-branches` | `users:manage` |
| 14 | 🧾 | Audit Logs | `/audit-logs` | `audit-logs` | `system:audit:read` |
| 15 | 🩺 | System Health | `/system-health` | `system-health` | `system:rbac:read` |
| 16 | 🔔 | Notifications | `/notifications` | `notifications` | — |
| 17 | ⚙️ | Settings | `/settings` | `settings` | `settings:manage` |

**Totals:** 17 top-level items, 19 sub-items (36 entries).

## Outline View

- 📊 Dashboard
- 🎨 Portfolio
  - 👤 Profile
  - 🌟 Hero
  - 📝 About
  - 🧠 Skills
  - 💼 Experience
  - 🎓 Education
  - 🛠️ Services
  - 💬 Testimonials
- 🗂️ Projects
- ✍️ Blog
- 🖼️ Media
- 🧱 CMS Builder
- 🎛️ Theme Builder
- 📈 Analytics
- 📋 Freelancer Sheets
  - 📅 Daily Sheets
  - 📊 Monthly Sheets
  - ✓ Approval Queue
- ⏱️ Timesheets
- 👥 Users
- 🔑 Identity & Access
  - 🧩 Resources
  - 👑 Roles
  - 🧑‍🤝‍🧑 Groups
  - 🙍 Users
- 🛡️ Admin
  - 👥 Users
  - 🔐 Roles & Permissions
  - 🧩 Resources
  - 🏢 Branches
- 🧾 Audit Logs
- 🩺 System Health
- 🔔 Notifications
- ⚙️ Settings

## Supabase Deployment Note

In the Supabase deployment the menu comes from the `menus` table instead
(seeded in `apps/backend/supabase/migrations/0023_dynamic_menu_fix.sql`), which
holds a smaller set: Dashboard, Projects, Settings, and Admin Console
(Manage Users, Manage Roles, Resources, Branches).
