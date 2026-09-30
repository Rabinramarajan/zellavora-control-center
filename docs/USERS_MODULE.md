# IAM Users

**Users** holds the current state of provisioned accounts: profile, organization, access and security. **User Requests** holds the approval and provisioning history. Adding a user always goes through a request (`+ Add User` → New User request → approval → provisioning).

## Routes

| UI route | Purpose |
|---|---|
| `/iam/users` | User Search: quick search (name / employee code / email / User ID) plus Status, Role, Group and Branch filters; **More Filters** for everything else. The row ⋮ menu shows only the actions the account's state allows. |
| `/iam/users/:id` | User Details: Overview, Personal, Employee, Contact, Organization, Groups, Roles & Permissions, Security, Sessions, Notes, Request History, Status History, Email History, Audit. Deep link with `?section=` (add `&edit=1` for editable sections). |
| `/iam/users/new` | Redirects to the New User request. |

API: `/api/v1/iam/users` (Swagger tag `iamUsers`). The detail endpoints are in `apps/backend/src/modules/users/user-admin.*`.

## Account status

Shown statuses: Invited, Pending Verification, Active, Inactive, Locked, Suspended, Disabled. **Invited** and **Pending Verification** are both stored as `PENDING` and differ only in whether a password has been set (see `account-status.ts`). Request statuses such as Pending Approval never appear here.

Every transition goes into `user_status_history`: admin status changes, lock/unlock, provisioning, invitation acceptance and cancellation.

## Actions by state

The rules live in `user-actions.ts` (backend, returned as `actions` on the profile) and `rowActions` (frontend, for list rows):

| State | Actions |
|---|---|
| Invited / Pending Verification | Edit, Manage Access, Resend Invitation, Cancel Invitation |
| Active | Edit, Manage Access, Send Password Reset, Require Password Change, Lock, Deactivate, Disable, Reset MFA (if enrolled), Revoke Sessions (if any) |
| Locked | Unlock, Send Password Reset, Reset MFA (if enrolled), Revoke Sessions (if any) |
| Inactive / Suspended | Edit, Activate, Disable |
| Disabled | Activate |

Every mutating action requires `users:manage`, asks for confirmation (and a reason where one is recorded) and is audited. **Require Password Change** signs the user out, blocks sign-in (`PASSWORD_CHANGE_REQUIRED`) and sends a reset link. The flag is cleared when the password is reset.

## Access

Roles are listed with their **assignment source**: `Direct`, or `Group: <name>` when inherited. Effective permissions are calculated from both. Group-inherited roles can only be removed by removing the group membership. `user_role_assignments.assigned_by/created_at` and `user_groups.assigned_by` record who granted the access and when.

## Emails

Password reset, invitation, lock / activate / deactivate and MFA reset emails are logged in `user_email_logs` with their delivery status. Invitations are handed to the queue, so they show **Queued**. The Email History tab also lists emails sent by this user's User Requests.

## Data

Migration `20261001010000_user_administration` adds:

- to `users`: `user_no` (shown as `USR000236`), employee, contact and organization fields, and `lock_reason`
- the `DISABLED` status value
- the tables `user_status_history`, `user_notes` and `user_email_logs`

Date of birth and gender are deliberately not collected.
