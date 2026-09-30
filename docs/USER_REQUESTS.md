# IAM User Requests

Approval workflow for account and access changes. Nothing changes in the directory until a request is approved **and** provisioned.

## Routes

| UI route | Purpose |
|---|---|
| `/iam/user-requests` | Search (filters, status counts, results) |
| `/iam/user-requests/create` | Step form that changes with the request type |
| `/iam/user-requests/:requestId` | Detail page (sections: Request, User, Employee, Contact, Organization, Access, Approval, Notes, Status History, Email History, Audit). Deep link with `?section=` |
| `/iam/user-requests/:requestId/edit` | Edit a Draft or Sent Back request |

API: `/api/v1/iam/user-requests` (see Swagger tag `iamUserRequests`). Module: `apps/backend/src/modules/user-requests`.

## Lifecycle

```
DRAFT → SUBMITTED → PENDING_APPROVAL → APPROVED → PROVISIONING → COMPLETED
                         │                              └→ FAILED (retryable)
                         ├→ SENT_BACK → (edit) → SUBMITTED
                         ├→ REJECTED
                         └→ CANCELLED
```

- **Approval chain** is created on submit: *Manager Approval* (only when a reporting manager is set and is not the requester) → *IAM / Admin Approval* → *Security Approval* (only when the change grants a privileged role: `owner`/`admin`/`super_admin`, or `*:*`, `users:manage`, `roles:manage`, `settings:manage`).
- A named approver (the manager) or anyone with `users:manage` can act on a step. Reject and Send Back require a comment.
- **COMPLETED means provisioned.** For `NEW_USER`, provisioning creates the account (status `PENDING`) with its organization, groups and roles, then sends an invitation. The request stays `PROVISIONING` until the invitee accepts (hook in `AuthService.acceptInvitation`).
- Status history (`user_request_events`) and notes (`user_request_notes`) are append-only. Every email attempt is logged in `user_request_emails` with its delivery status. Failed emails can be retried.
- Audit entries go to `audit_logs` (`resource = 'user_request'`, and provisioning writes `resource = 'user'` with `metadata.requestId`).

## Data

`user_requests.payload` holds the request sections (`user`, `employee`, `contact`, `organization`, `access`). Search columns (name, email, employee code, branch/department/team, group/role ids) are copied from the payload on every save. Reference numbers `UR-YYYY-NNNNNN` come from the `user_request_ref_seq` sequence.

`users` gains `employee_code` (unique), `user_type`, `branch_id` and `reporting_manager_id`.

Migration: `prisma/migrations/20261001000000_user_requests`.
