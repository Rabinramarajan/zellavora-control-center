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

Base path `/api/v1/organization-settings`; stored in `common_configurations`.

| Method | Path         | Guard                                                                         |
| ------ | ------------ | ----------------------------------------------------------------------------- |
| GET    | `/`, `/:key` | signed in; organization from the token (a mismatching supplied id is refused) |
| POST   | `/`          | `settings:write`                                                              |

`/api/v1/iam/configurations` manages the same table with `settings:manage`.

## Notifications API

Base path `/api/v1/notifications`. The router applies `authenticate`.

| Method | Path | Guard     | Behaviour                                                                                                                  |
| ------ | ---- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/`  | signed in | The caller's own notifications, newest `created_at` first (column added by migration `20261016010000_notification_created_at`). `page` and `pageSize` (default 25, max 100); other query fields answer 400 |

The organization and recipient always come from the verified token. `POST /send` (which accepted any `organizationId` and enqueued a `send-otp` job to a hard-coded address) was deleted (review C3). Server code that needs an in-app message (timesheet reviews) calls `NotificationService.sendNotification` directly; it never sends email.

The frontend notifications page also calls `/notifications/broadcast` and `/notifications/templates`, which do not exist. Working in-app messages and bulk email go through `/api/v1/iam/communications`.

## Lookups API

Base path `/api/v1/lookups`; read-only, **requires sign-in** (review M9).

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

- Fixed (**C3**): notifications require sign-in and return only the caller's own rows; the send route is deleted. The frontend page still calls `/notifications/broadcast` and `/notifications/templates`, which do not exist (see the notifications rebuild, prompt P8).
- Non-profile settings sections live in process memory, shared across tenants (review **M11**). Persist them through `organization-settings` with `settings:write`.
- Two modules (`settings`, `configuration`) write the same table under different permissions. Merge them.
