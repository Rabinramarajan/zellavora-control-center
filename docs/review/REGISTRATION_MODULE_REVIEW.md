# Registration Module — End-to-End Implementation Review

Scope: self-service account registration, from the Angular `/auth/register` page through
`POST /api/v1/auth/register`, the PENDING account, the auto-raised User Request, approval,
provisioning and first sign-in.

Reviewed at commit `b623084` (branch `main`).

---

## 1. Summary

Registration is **not a standalone module**. It is a feature-flagged slice of the `auth`
module on the backend and of the `auth` feature on the frontend, which hands off to the
`user-requests` module for approval and provisioning.

| Concern | Location |
|---|---|
| Feature flag | `ALLOW_SELF_REGISTRATION` → [env.ts:79](apps/backend/src/config/env.ts#L79) |
| Public config | `GET /api/v1/auth/config` → [auth.service.ts](apps/backend/src/modules/auth/auth.service.ts) `getPublicConfig` |
| Validation | [auth.dto.ts:63](apps/backend/src/modules/auth/auth.dto.ts#L63) `RegisterSchema` |
| Endpoint | [auth.routes.ts:183](apps/backend/src/modules/auth/auth.routes.ts#L183) |
| Handler | [auth.controller.ts:86](apps/backend/src/modules/auth/auth.controller.ts#L86) |
| Business logic | [auth.service.ts](apps/backend/src/modules/auth/auth.service.ts) `register` |
| Persistence | [auth.repository.ts](apps/backend/src/modules/auth/auth.repository.ts) |
| Approval request | [user-request.service.ts:799](apps/backend/src/modules/user-requests/user-request.service.ts#L799) `onSelfRegistration` |
| Activation | [user-request.provisioner.ts:196](apps/backend/src/modules/user-requests/user-request.provisioner.ts#L196) `activateSelfRegistered` |
| UI page | [register.page.ts](apps/zcc-frontend/src/app/features/auth/pages/register/register.page.ts) |
| Route guard | [auth.guard.ts:38](apps/zcc-frontend/src/app/core/auth/auth.guard.ts#L38) `registrationGuard` |

**Verdict:** the happy path is well built — transactional account creation, enumeration-resistant
responses, best-effort side effects that cannot roll back a completed registration, a real approval
workflow with audit trail, and a polished two-step accessible form. Four defects are worth fixing
before this is relied on in production; see §8.

---

## 2. End-to-end flow

```
Browser                         Backend                             Data
───────                         ───────                             ────
GET /auth/register
  └─ registrationGuard
       GET /auth/config  ──────▶ getPublicConfig()
       selfRegistrationEnabled? ◀── { selfRegistrationEnabled,
       false → redirect /login       requireEmailVerification,
                                     supportEmail, passwordPolicy }

  Step 1: org + name + email
       GET /auth/clients ──────▶ TenantService.listActive()  ──────▶ organizations
  Step 2: password + terms

POST /auth/register  ──────────▶ registerLimiter (5 / 60 min / IP)
                                 RegisterSchema.parse()
                                 flag off → 404 REGISTRATION_DISABLED
                                 tenant lookup by clientCode
                                   not found → generic 202
                                 findUserByEmail
                                   exists → generic 202 (logged)
                                 assertPasswordPolicy(tenant)
                                 PasswordService.hash (bcrypt)
                                 ┌ transaction ────────────────────┐
                                 │ users.create status=PENDING     │──▶ users
                                 │ ensureMembership                │──▶ user_tenants
                                 │ addPasswordHistory              │──▶ password_history
                                 └─────────────────────────────────┘
                                 audit 'user_registered'            ──▶ audit_logs
                                 ┌ best effort ────────────────────┐
                                 │ onSelfRegistration()            │──▶ user_requests
                                 │   NEW_USER / PENDING_APPROVAL   │    user_request_approvals
                                 │   1 step: IAM / Admin Approval  │    user_request_events
                                 │ sendVerificationEmail()         │──▶ email_verifications
                                 └─────────────────────────────────┘    + queue job
       202 { ok, message }  ◀────
  Success panel + resend link

Admin: /iam/user-requests → POST /user-requests/:id/approve
                                 approve() → status APPROVED
                                 runProvisioning()
                                   targetUserId set → activateSelfRegistered()
                                 ┌ transaction ────────────────────┐
                                 │ users.status = ACTIVE           │──▶ users
                                 │ syncAccess (roles/groups/teams) │──▶ user_roles …
                                 │ audit 'user.activated'          │──▶ audit_logs
                                 │ recordStatusChange              │──▶ status history
                                 └─────────────────────────────────┘
                                 request → COMPLETED

User: POST /auth/login          assertAccountUsable (PENDING blocks)
                                 requireEmailVerification gate
                                 MFA / completeLogin
```

---

## 3. API reference

All paths are relative to `/api/v1`. Every endpoint on the registration path is public
(`security: []` in the OpenAPI annotations).

### 3.1 `GET /auth/config`

Public bootstrap. Drives the route guard and the client-side password rules.

Response `200`:

```json
{
  "selfRegistrationEnabled": false,
  "requireEmailVerification": true,
  "supportEmail": "support@example.com",
  "passwordPolicy": {
    "minLength": 12,
    "maxLength": 128,
    "requireUppercase": true,
    "requireLowercase": true,
    "requireDigit": true,
    "requireSymbol": true
  }
}
```

Notes:
- `passwordPolicy` is **hard-coded** in `getPublicConfig()`, while the server enforces the
  per-organization policy from `SecurityPolicyService`. See finding R-3.
- No rate limiter, and no `Cache-Control: no-store` (unlike `/auth/clients`).

### 3.2 `GET /auth/clients`

Organizations offered in the picker. Sets `Cache-Control: no-store`.

Response `200`: `{ "tenants": [{ "id", "name", "clientCode", "logoUrl" }] }`

### 3.3 `POST /auth/register`

| Property | Value |
|---|---|
| Rate limit | bucket `auth:register`, 5 requests / 60 min, keyed by `req.ip` |
| Auth | none |
| Success | `202 Accepted` |
| Enabled by | `ALLOW_SELF_REGISTRATION=true` |

Request body (`RegisterSchema`):

| Field | Rules |
|---|---|
| `clientCode` | trimmed, 2–16 chars, `^[A-Za-z0-9-]+$` |
| `firstName` | trimmed, 2–100 chars, no C0/DEL/C1 control characters |
| `lastName` | same as `firstName` |
| `email` | trimmed, lower-cased, ≤254 chars, email format |
| `password` | `PasswordPolicySchema`; never truncated, over-long input is rejected |
| `acceptTerms` | must be literal `true` — "You must accept the terms" |

```json
{
  "clientCode": "acme",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "email": "ada@acme.com",
  "password": "S0me-Str0ng-Pass!",
  "acceptTerms": true
}
```

Responses:

| Status | Code | Meaning |
|---|---|---|
| `202` | — | `{ "ok": true, "message": "Your registration has been submitted and is awaiting administrator approval. …" }` — returned identically for a new account, an unknown `clientCode`, and an already-registered email (enumeration resistance) |
| `400` | `PASSWORD_POLICY` | Organization password policy rejected the password; carries `field: "password"` |
| `400` | Zod validation envelope | Field-level messages, consumed by `mapServerErrors` on the client |
| `404` | `REGISTRATION_DISABLED` | Flag off — 404 rather than 403, so the feature is not discoverable |
| `429` | — | Rate limit |

### 3.4 `POST /auth/verify-email`

Rate limit `auth:token` (20 / 15 min). Body `{ "token": "<20–256 chars>" }`.

- `200` `{ "ok": true, "alreadyVerified": false }` — marks `emailVerified`, stamps
  `emailVerifiedAt`, invalidates all other verification rows in one transaction, audits
  `email_verified`.
- `200` `{ "ok": true, "alreadyVerified": true }` — idempotent replay.
- `400` `INVALID_VERIFICATION_TOKEN` — unknown hash, or missing/deleted user.
- `400` `VERIFICATION_TOKEN_EXPIRED` — already consumed, or past `expiresAt`.

Tokens are stored as `OneTimeTokenService.hash(token)`; the plaintext exists only in the
emailed link.

### 3.5 `POST /auth/resend-verification`

Rate limit `auth:email` (5 / 15 min). Body `{ "email": "…" }`. Always
`202 { "ok": true, "message": "If verification is required, instructions will be sent." }`.
Internally capped at 3 emails per 15-minute window per user
(`MAX_EMAILS_PER_WINDOW`, `RESEND_WINDOW_MS`).

### 3.6 Approval endpoints (authenticated, permission-gated)

Registration completes through the User Requests API. Each route is wrapped in
`can('<permission>')`:

| Method | Path | Permission |
|---|---|---|
| `GET` | `/user-requests` | `user-requests:read` |
| `GET` | `/user-requests/:id` | `user-requests:read` |
| `GET` | `/user-requests/:id/access` | `user-requests:read` |
| `GET` | `/user-requests/:id/audit` | `user-requests:audit:read` |
| `POST` | `/user-requests/:id/approve` | `user-requests:approve` |
| `POST` | `/user-requests/:id/reject` | `user-requests:reject` |
| `POST` | `/user-requests/:id/send-back` | `user-requests:send-back` |
| `POST` | `/user-requests/:id/cancel` | `user-requests:cancel` |
| `POST` | `/user-requests/:id/retry-provisioning` | `user-requests:retry` |
| `POST` | `/user-requests/:id/notes` | `user-requests:notes:create` |
| `POST` | `/user-requests/:id/emails/:emailId/retry` | `user-requests:retry` |

---

## 4. Backend implementation detail

### 4.1 The request created by `onSelfRegistration`

| Field | Value |
|---|---|
| `type` | `NEW_USER` |
| `status` | `PENDING_APPROVAL` |
| `priority` | `NORMAL` |
| `source` | `SYSTEM` |
| `refNo` | `repo.nextRefNo(tx)` |
| `targetUserId` | the newly created PENDING user — the discriminator that routes provisioning to `activateSelfRegistered` instead of `createUser` |
| `requestedById` | the registrant themself |
| `justification` | `"Self-registration through the sign-up page"` |
| `currentStep` | `1` |
| `payload` | `user: { firstName, lastName, userType: 'EMPLOYEE' }`, `contact: { workEmail }`; `employee`, `organization`, `access` empty |

One approval step is created: level 1, `IAM / Admin Approval`, `approverId: null`,
`approverName: 'IAM Administrators'`, `status: PENDING`. Two events are written
(`→ SUBMITTED`, `SUBMITTED → PENDING_APPROVAL`) plus an audit entry
`user_request.self_registered`.

Because the payload carries no `branchId`, `departmentId`, `employeeCode` or `employmentType`,
a self-registration request would **fail** `validateForSubmit('NEW_USER', …)`. It bypasses that
function by being inserted directly at `PENDING_APPROVAL` — intentional, but it means the
approving admin must fill the organizational fields via `PATCH /user-requests/:id` (or send the
request back) before the record is complete.

### 4.2 Transaction boundaries

Inside the account transaction: `users.create`, `ensureMembership`, `addPasswordHistory`.

Deliberately outside, each with a `.catch` that only logs:
- `onSelfRegistration` — "a failure here must not roll back a user who has already been told
  they registered, and the request can be reconciled from the PENDING account."
- `sendVerificationEmail` — recoverable through `/auth/resend-verification`.

Both comments are accurate and the `register` spec asserts the behaviour
([auth.service.spec.ts:197-214](apps/backend/src/modules/auth/auth.service.spec.ts#L197)).
The residual risk is a PENDING user with **no** request row and no alert — reconciliation is
described but not implemented (R-6).

### 4.3 Security posture

| Control | Implementation |
|---|---|
| Enumeration resistance | One response for new / unknown-tenant / existing-email. The existing-email path logs without the address |
| Timing | The *login* path equalises timing with `dummyHash()`; `register` returns early for an existing email, so it is measurably faster — a timing oracle, though the 5/hour limit makes it expensive to exploit (R-8) |
| Password storage | bcrypt via `PasswordService.hash` at `config.bcryptRounds`; history row written at creation |
| Password policy | Per-organization via `SecurityPolicyService.assertPasswordAllowed` — min length plus `disallowEmailInPassword` |
| Sign-in blocked until approval | `status: 'PENDING'` plus `assertAccountUsable` |
| Token handling | Verification tokens hashed at rest; the frontend strips `?token=` from the URL, history entry and Referer via `takeQueryToken` |
| Rate limiting | Per-bucket Redis counters, so login traffic cannot exhaust the register quota |
| Audit | `user_registered`, `user_request.self_registered`, `user.activated`, plus `recordStatusChange` |
| Email XSS | `escapeHtml` in the notifier |

### 4.4 Tests

- [auth.service.spec.ts:156-220](apps/backend/src/modules/auth/auth.service.spec.ts#L156) —
  `describe('register')`: creates with `status: PENDING`, raises the request with the right
  payload, returns the generic response, and survives a failing request or email side effect.
  The flag is pinned so the suite does not depend on the ambient env.
- [api-contract.spec.ts](apps/backend/src/routes/api-contract.spec.ts) — asserts every
  canonical endpoint, including `postAuthRegister`, is documented.
- No integration test covers register → approve → activate → login as one sequence.

---

## 5. Frontend implementation detail

### 5.1 Route and guard

[auth.routes.ts](apps/zcc-frontend/src/app/features/auth/auth.routes.ts) declares
`/auth/register` with `canActivate: [guestGuard, registrationGuard]` and a lazy
`loadComponent`. Login and register sit outside `AuthLayoutComponent` because they own a
full-screen composition.

`registrationGuard` calls `AuthService.config()` and redirects to `/auth/login` when
`selfRegistrationEnabled` is false or the call fails. `config()` is memoised with
`shareReplay({ bufferSize: 1, refCount: false })` and cleared only on error, so a server-side
flag flip is not picked up until a full page reload (R-10).

### 5.2 `RegisterPage`

Standalone, `OnPush`, signal forms (`@angular/forms/signals`).

- `model` — one `signal` holding `clientCode`, `firstName`, `lastName`, `email`, `password`,
  `confirmPassword`, `acceptTerms`.
- `form` — `form(model, path => …, { submission: { action: () => this.submit() } })` with
  `required`, `nameRules`, `emailRules`, `newPasswordRules(policy)`, `confirmPasswordRules`,
  and a `validate` on `acceptTerms`.
- `policy` — `injectPasswordPolicy()`: the server policy, falling back to
  `DEFAULT_PASSWORD_POLICY` until `/auth/config` resolves, or if it fails.
- `orgs` / `orgOptions` — `toSignal(auth.clients())` with `catchError(() => of([]))`;
  `orgsLoading` drives the placeholder text.
- `step` — `signal<1 | 2>`. `next()` touches only the step-1 fields, focuses the first invalid
  one, then moves focus into step 2. `goTo` moves focus so keyboard and screen-reader users are
  not stranded.
- `submit()` trims and lower-cases before posting, sets `submitted` on success, and on failure
  maps server errors through `mapServerErrors`, returning them to the signal-forms action so
  they render under their fields; if any belong to step 1 it jumps back to step 1.
- `initials`, `year`, `highlights` are presentation only.

### 5.3 Template and accessibility

- Skip link to `#register-card`; `aria-label` on each form; `role="list"` on decorative lists;
  decorative SVG and imagery marked `aria-hidden` or given empty `alt`.
- The stepper is an `<ol>` with `aria-current="step"` and an `sr-only` "Step N of M" prefix.
- The terms checkbox wires `aria-invalid` and `aria-describedby` to `#terms-error`.
- The submit button shows a spinner and "Creating account…" while `form().submitting()`.
- The success panel confirms the submitted email, links to sign-in, and offers
  `/auth/resend-verification`.
- `autocomplete` is correct throughout (`given-name`, `family-name`, `email`, `new-password`).

### 5.4 Client contract

`RegisterRequest` in [auth.model.ts:78](apps/zcc-frontend/src/app/shared/models/auth.model.ts#L78)
matches `RegisterSchema` field for field, including `acceptTerms: true` as a literal type.
`AuthService.register()` is a thin `POST` returning `GenericMessageResponse` — no token is
issued, which is correct for a pending account.

`auth-validation.ts` mirrors `auth.dto.ts` and says so in its header. Current drift: the client
enforces uppercase/lowercase/digit/symbol from the advertised policy, while the server enforces
only min length and the email-in-password rule (R-3).

---

## 6. Configuration

| Variable | Default | Effect |
|---|---|---|
| `ALLOW_SELF_REGISTRATION` | `false` (strict `=== 'true'`) | Enables the endpoint and the route |
| `REQUIRE_EMAIL_VERIFICATION` | `true` (`!== 'false'`) | Blocks sign-in for unverified accounts that have a verification record |
| `EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS` | — | Verification token TTL |
| `APP_URL` | — | Base for `/auth/verify-email?token=…` and request deep links |
| `SUPPORT_EMAIL` | — | Surfaced through `/auth/config` |

Both flags are **global**, not per-organization — see R-4.

---

## 7. Data touched

`users` (`status=PENDING`, `emailVerified=false`, `termsAccepted`/`privacyAccepted` plus
timestamps, `passwordChangedAt`, `tenantId`), `user_tenants`, `password_history`,
`email_verifications`, `user_requests`, `user_request_approvals`, `user_request_events`,
`user_request_emails`, `audit_logs`, and the account status history written by
`recordStatusChange`.

---

## 8. Findings

### R-1 · High — the "approval required" email goes to the registrant, not to approvers

`UserRequestNotifier.notify(request, template, recipient, trigger, extra?)`, but
[user-request.service.ts:876](apps/backend/src/modules/user-requests/user-request.service.ts#L876)
calls:

```ts
await this.notifier.notify(request, 'APPROVAL_REQUIRED', input.email, null)
```

Two problems. The recipient is `input.email` — the person who just registered — so they receive
*"Approval required: REQ-123"* with an admin deep link, while **no IAM administrator is notified
at all**. The approval step is created with `approverId: null`, so nothing else fans out to
approvers either. And `trigger` is passed `null` against a `string` parameter, so the recorded
trigger on the email row is empty.

Net effect: self-registrations sit at `PENDING_APPROVAL` until somebody happens to open the
User Requests screen.

Fix: resolve the holders of `user-requests:approve` for the organization (or a configured IAM
distribution address) and notify them; send the registrant a `SUBMITTED`-style acknowledgement
instead; pass a real trigger string.

### R-2 · High — approved accounts can still be locked out by email verification

`activateSelfRegistered` sets `status: 'ACTIVE'` but leaves `emailVerified` untouched. With
`REQUIRE_EMAIL_VERIFICATION=true` and a verification record present (always, for
self-registration), `login` throws `EMAIL_NOT_VERIFIED` even after an admin approved the
account. The success panel does mention the verification email, but an approved user who missed
or lost it hits a hard block with no in-flow remedy beyond finding
`/auth/resend-verification` themselves.

Compare `acceptInvitation`, which sets `emailVerified: true` because the link proved ownership.

Fix: either require verification *before* the request reaches `PENDING_APPROVAL`, or surface
verification state in the approval UI, or treat admin approval as sufficient and verify on
first sign-in.

### R-3 · Medium — advertised password policy and enforced password policy differ

`/auth/config` reports `requireUppercase/Lowercase/Digit/Symbol: true` from a literal object,
while `SecurityPolicyService.assertPasswordAllowed` enforces only `minLength` and
`disallowEmailInPassword`. The client blocks passwords the server would accept, and a tenant
that raises `minLength` above 12 is not reflected in the UI — the user is told 12 and then
rejected at submit with a server-side `PASSWORD_POLICY` error.

Fix: derive `passwordPolicy` in `getPublicConfig()` from `SecurityPolicyService`, and make the
character-class rules real policy fields enforced server-side.

### R-4 · Medium — self-registration is global, but the form is per-organization

`selfRegistrationEnabled` is one process-wide env var, while the form asks which organization to
join and `/auth/clients` lists every active tenant. Any tenant in the deployment becomes a valid
registration target as soon as the flag is on, and no tenant can opt out.

Fix: add a per-organization `allowSelfRegistration` column and check it in `register` after the
tenant lookup, returning the same generic 202 when it is off so enumeration resistance is
preserved.

### R-5 · Medium — a cross-tenant email collision silently discards the registration

`findUserByEmail(dto.email)` is not scoped to the tenant, so someone who already has an account
in tenant A and legitimately registers for tenant B gets the generic success message and no
account. The log line ("registration attempted for an existing account") deliberately omits the
address, so it is not actionable either.

Login looks up `findUserInTenant(email, tenantId)`, so the data model clearly contemplates the
same address across tenants.

Fix: scope the existence check to the tenant, and when the user exists elsewhere, add a
membership rather than creating a user — still returning the generic response.

### R-6 · Low — a registration can leave an orphaned PENDING account

If `onSelfRegistration` fails, the user exists and was told they registered, but no request row
exists. The code says it "can be reconciled from the PENDING account" and nothing reconciles
it; there is no PENDING-without-request alert or sweeper.

Fix: a scheduled reconciliation that raises the missing request, or an admin list of PENDING
accounts with no open request.

### R-7 · Low — self-registration requests are structurally incomplete

The payload sets only `firstName`, `lastName`, `userType: 'EMPLOYEE'` and `workEmail`. No
`username`, `employeeCode`, `employmentType`, `branchId` or `departmentId` — all of which
`validateForSubmit` treats as required for `NEW_USER`, and which an admin-raised request could
not have submitted without. Approval therefore activates an account with no branch, department,
role or group (`syncAccess` runs with empty requested sets).

Fix: have the approval screen require the missing organizational fields before `approve` is
allowed for `source: 'SYSTEM'` requests, or run `validateForSubmit` at approval time.

### R-8 · Low — timing oracle on the existing-email path

`register` returns immediately for a known email, skipping `assertPasswordPolicy` and the bcrypt
hash, so responses are measurably faster than for a new address. The login path already solves
exactly this with `dummyHash()`.

Fix: perform a dummy bcrypt hash before the early return.

### R-9 · Low — the IP-keyed register limit penalises shared egress

`limit('register', 60, 5)` has no `keyGenerator`, so it falls back to `req.ip`: 5 registrations
per hour per IP. An office or school behind one NAT address exhausts that during onboarding.

Fix: keep a strict per-IP ceiling but add a looser per-(IP, clientCode) or per-email bucket, or
raise the IP limit behind a CAPTCHA/BotID fallback.

### R-10 · Informational — stale `registrationGuard` config

`AuthService.config()` caches with `refCount: false` for the lifetime of the app, so toggling
`ALLOW_SELF_REGISTRATION` requires a page reload before the route behaves correctly. Acceptable
for a deploy-time flag; worth revisiting if it becomes runtime-configurable, which R-4 would
make it.

### R-11 · Informational — `/auth/config` is unlimited and cacheable

Unlike `/auth/clients`, `/auth/config` sets no `Cache-Control: no-store` and has no rate
limiter. It leaks nothing sensitive today, but it is the one public endpoint that advertises
whether registration is open.

---

## 9. Suggested order of work

1. R-1 — approvers must be notified; without it the workflow does not function unattended.
2. R-2 — approved users must be able to sign in.
3. R-5, R-4 — correct the multi-tenant semantics before more tenants are onboarded.
4. R-3, R-7 — align the advertised policy and the request's completeness.
5. R-8, R-9, R-6 — hardening and operability.
6. Add an integration test covering register → approve → activate → login, which no current
   suite exercises end to end.
