# IAM: security policy, sessions, configuration, communications and email

Organization-level controls: password, sign-in and MFA policy; the active-session console; key/value configuration; messages and bulk email to members; and the platform's SMTP settings.

## Code

| Area                 | Backend                                                                            | Frontend                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Security policy      | `modules/security-policy/`                                                         | `features/iam/security/security-policy.component.ts` (one component, three sections)                |
| Sessions console     | `modules/sessions/`                                                                | `features/iam/sessions/`                                                                            |
| Common configuration | `modules/configuration/`                                                           | `features/iam/configuration/` (routed under `/system/configuration`)                                |
| Communications       | `modules/communications/`                                                          | `features/iam/communications/` (routed under `/system/notification-management` and `/system/email`) |
| Email settings       | `modules/email-settings/`, `services/email.service.ts`, `services/email-config.ts` | `features/settings/components/email-settings-form`                                                  |

## Security policy

Base path `/api/v1/iam/security`; every route needs `settings:manage`.

| Method | Path                 | Purpose                                                                                                                                |
| ------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/policies`          | Current password, login and MFA policy for the organization                                                                            |
| PUT    | `/policies/password` | Min length (12–128), history depth (0–24), disallow email in password                                                                  |
| PUT    | `/policies/login`    | Lockout threshold (3–20) and minutes, session idle minutes, session lifetime (1–90 days), max concurrent sessions, allowed IPv4 ranges |
| PUT    | `/policies/mfa`      | Enforce MFA for the organization                                                                                                       |
| GET    | `/mfa/compliance`    | Who has / has not enrolled (paged, filter `enrolled`)                                                                                  |

These are enforced at sign-in and on every request: IP allow-list and lockout in `AuthService.login`, idle timeout in `authenticate`, lifetime and concurrency when sessions are created. Defaults live in `security-policy.service.ts` (e.g. lifetime 30 days, unlimited concurrent sessions, no IP restriction).

## Sessions console

Base path `/api/v1/iam/sessions`.

| Method | Path             | Permission                                     |
| ------ | ---------------- | ---------------------------------------------- |
| GET    | `/`, `/stats`    | `sessions:view`                                |
| DELETE | `/:id`           | `sessions:revoke`                              |
| DELETE | `/users/:userId` | `sessions:revoke` (all of one user's sessions) |

Scoped to the caller's organization.

## Common configuration

Base path `/api/v1/iam/configurations`; `settings:manage`. GET `/` (search), PUT `/` (upsert by key), DELETE `/:key`. Stored in `common_configurations` per organization. The older `/api/v1/organization-settings` module reads and writes the same table (see [settings, notifications and lookups](settings-notifications-lookups.md)).

## Communications

Base path `/api/v1/iam/communications`; `settings:manage`; sends are rate-limited per user.

| Method | Path                             | Body                                                                                           |
| ------ | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| POST   | `/messages`                      | In-app message: audience, title (≤150), body (≤5,000), type `info`/`success`/`warning`/`error` |
| POST   | `/emails`                        | Email: audience, subject (≤200), body (≤20,000)                                                |
| GET    | `/history?channel=in_app\|email` | Sent history                                                                                   |

Audience is one of: everyone in the organization, explicit users (≤1,000), or members of groups, teams or departments (≤50 each).

## Email settings

Base path `/api/v1/settings/email`; `settings:manage`.

| Method | Path    | Purpose                                                                    |
| ------ | ------- | -------------------------------------------------------------------------- |
| GET    | `/`     | Current SMTP settings; secrets come back as a placeholder, never the value |
| PUT    | `/`     | Update; secrets encrypted with `EncryptionService` before storage          |
| POST   | `/test` | Send a test email (rate-limited)                                           |

## Data model

`OrganizationSettings` (policies), `Session`, `CommonConfiguration`, `Notification` (in-app messages), `EmailSetting`, `AuditLog`.

## Tests

`security-policy.service.spec.ts`, `sessions.service.spec.ts`, `configuration.service.spec.ts`, `communications.service.spec.ts`, `email-settings.service.spec.ts`. No frontend specs.

## Review notes

- **Email settings are platform-wide but guarded by an organization permission** (review **M12**). An administrator with `settings:manage` in any organization can change the SMTP server every organization sends through. Gate it behind a platform permission or make it per organization.
- `settings:manage` also guards security policy, configuration and bulk messaging. Consider splitting it (`security:manage`, `communications:send`) so sending an announcement does not imply changing the lockout policy.
