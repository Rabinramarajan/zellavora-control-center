# Settings, notifications and lookups

Small supporting modules: the user-facing **settings** page and the organization settings store, the **notifications** module, and **lookups** (drop-down lists such as countries and languages).

## Code

| Area                  | Backend                                                         | Frontend                                                                                                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings page         | `routes/settings.ts` (`/api/v1/settings`, `/settings/:section`) | `features/settings/` (`settings.component`, tabs: General, Profile, Notifications, Email; `general-settings-form`, `profile-settings-form`, `email-settings-form`, `appearance-settings`, `avatar-uploader`) via `core/services/api-integration.service.ts` |
| Organization settings | `modules/settings/` (`/api/v1/organization-settings`)           | —                                                                                                                                                                                                                                                           |
| Notifications         | `modules/notification/`                                         | `features/notifications/notifications.component.ts`, `core/api/notification.api.ts`, `core/repositories/notification.repository.ts`                                                                                                                         |
| Lookups               | `modules/ddl/` (`ddl.data.ts` seed lists)                       | used by registration and user forms                                                                                                                                                                                                                         |

## Settings page API

Base path `/api/v1`; all routes need sign-in.

| Method | Path                 | Behaviour                                                                                                                                                                                                                                   |
| ------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/settings`          | All sections                                                                                                                                                                                                                                |
| GET    | `/settings/:section` | One section; `profile` reads the user record                                                                                                                                                                                                |
| PUT    | `/settings/:section` | `profile`: updates the caller's name, bio, location (country) and phone in the database. **Any other section** (`general`, `notifications`, …) is merged into an in-memory object shared by every user and organization and lost on restart |

The Email tab uses `/api/v1/settings/email` (see [security and communications](iam-security.md)); Appearance is local (light/dark/system in `localStorage` key `zcc-theme`).

## Organization settings API

Base path `/api/v1/organization-settings` (alias `/api/v1/clean/settings`); stored in `common_configurations`.

| Method | Path         | Guard                                                                         |
| ------ | ------------ | ----------------------------------------------------------------------------- |
| GET    | `/`, `/:key` | signed in; organization from the token (a mismatching supplied id is refused) |
| POST   | `/`          | `settings:write`                                                              |

`/api/v1/iam/configurations` manages the same table with `settings:manage`.

## Notifications API

Base path `/api/v1/notifications` (alias `/api/v1/clean/notifications`).

| Method | Path                 | Guard    | Behaviour                                                                                             |
| ------ | -------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| GET    | `/?organizationId=…` | **none** | Notifications of the given organization                                                               |
| POST   | `/send`              | **none** | Create a notification; when `channels` includes `email`, enqueues a `send-otp` job to a fixed address |

The frontend notifications page also calls `/notifications/broadcast` and `/notifications/templates`, which do not exist. Working in-app messages and bulk email go through `/api/v1/iam/communications`.

## Lookups API

Base path `/api/v1/lookups` (alias `/api/v1/clean/ddls`); public, read-only.

| Method | Path                           | Returns                                                                                            |
| ------ | ------------------------------ | -------------------------------------------------------------------------------------------------- |
| GET    | `/`                            | Every list, grouped by type                                                                        |
| GET    | `/types?type=country,language` | Only the requested lists                                                                           |
| GET    | `/:type`                       | One list: `country`, `language`, `gender`, `industry`, `organization_size`, `timezone`, `use_case` |

## Data model

`CommonConfiguration`, `Notification`, `Ddl`, `User` (profile fields).

## Tests

`modules/settings/settings.controller.spec.ts`. None for notifications, lookups, `routes/settings.ts` or the settings page.

## Review notes

- **Notifications endpoints have no authentication** (review **C3**), and the frontend page calls routes that do not exist.
- Non-profile settings sections live in process memory, shared across tenants (review **M11**). Persist them through `organization-settings` with `settings:write`.
- Two modules (`settings`, `configuration`) write the same table under different permissions. Merge them.
