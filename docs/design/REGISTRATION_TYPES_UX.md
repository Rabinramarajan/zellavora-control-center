# Registration Types — UI/UX Design Spec

Scope: the `/auth/register` screen only. Covers the registration-type fork and the three
per-type wizards from the registration architecture proposal (`ORGANIZATION_MEMBER`,
`INDIVIDUAL`, `CREATE_ORGANIZATION`).

Companion docs: [REGISTRATION_MODULE_REVIEW.md](../review/REGISTRATION_MODULE_REVIEW.md) (defects
this design closes), [CODE_CLEANUP.md](../CODE_CLEANUP.md).

---

## 1. Design system in force

This page does **not** use Angular Material or a light theme. It inherits the auth showcase,
which is dark-only. Reuse it; do not introduce a second visual language.

| Concern | Source of truth |
|---|---|
| Shell, aurora, card, stepper, submit, focus rings | [auth-showcase.scss](../../apps/zcc-frontend/src/app/features/auth/ui/auth-showcase.scss), [register.page.scss](../../apps/zcc-frontend/src/app/features/auth/pages/register/register.page.scss) |
| Text / select / searchable-select controls | `@zellavoras/ui` (`SelectControl`), [auth-field.component.ts](../../apps/zcc-frontend/src/app/features/auth/ui/auth-field.component.ts) |
| Alerts, password rules, OTP | [auth-alert](../../apps/zcc-frontend/src/app/features/auth/ui/auth-alert.component.ts), [password-requirements](../../apps/zcc-frontend/src/app/features/auth/ui/password-requirements.component.ts), [otp-input](../../apps/zcc-frontend/src/app/features/auth/ui/otp-input.component.ts) |
| Forms | `@angular/forms/signals` (`form()`, `FormField`, `FormRoot`) |
| Validation rules | [auth-validation.ts](../../apps/zcc-frontend/src/app/features/auth/ui/auth-validation.ts), [form-errors.ts](../../apps/zcc-frontend/src/app/features/auth/ui/form-errors.ts) |

Existing tokens: `--lp-violet #8b5cf6`, `--lp-indigo #6366f1`, `--lp-cyan #22d3ee`,
`--lp-emerald #34d399`, `--lp-card`, `--lp-card-border`, `--auth-text{,-strong,-muted}`,
`--auth-accent`, `--auth-danger`.

**One addition only** — a per-type accent, used on the type-card icon ring and the selected
state. Everything else (submit gradient, title accent, stepper active state) stays violet to
indigo so the brand does not shift under the user mid-flow.

```scss
.rt-card--org    { --rt-accent: var(--lp-indigo); }   /* Join an Organization */
.rt-card--solo   { --rt-accent: var(--lp-cyan); }     /* Individual */
.rt-card--create { --rt-accent: var(--lp-emerald); }  /* Create Organization */
```

Contrast: every accent above is used for 1px borders, icon glyphs of 20px or more, and glow
only — never for body text on glass. Body copy keeps `--auth-text`; muted copy keeps
`--auth-text-muted`. Selected state is **never** colour-only (section 6).

---

## 2. The fork is a mode, not a step

The proposal's "Step 1 — Account Type" should **not** be rendered as stepper step 1.

Reason: the branches have 2, 2 and 3 remaining steps. A stepper that shows "1 of 3" and then
"1 of 4" after a click is a progress indicator that lies, and users reading it as progress feel
the form grew. Account type is a *mode selector* — it changes which form you are filling, not
how far through it you are.

Render it as a **pre-step** that owns the card, then collapse it into a persistent, changeable
chip above the stepper:

```
+- card -----------------------------------+   +- card -----------------------------------+
| GET STARTED                              |   | +------------------------------------+   |
| Create your account                      |   | | [#] Join an Organization   Change  |   |  <- type chip
| How will you use Zellavora?              |   | +------------------------------------+   |
|                                          |   | Create your account                      |
| +--------------------------------------+ |   | Join your organization's workspace.       |
| | [#] Join an Organization           > | |   |                                           |
| |     Your company already uses ZCC    | |   | (1)-Organization--(2)-Security--          |  <- stepper
| +--------------------------------------+ |   |                                           |
| +--------------------------------------+ |   | [ Organization             v ]            |
| | [@] Individual                     > | |   | [ First name ] [ Last name ]              |
| |     A personal standalone account    | |   | [ Work email               ]              |
| +--------------------------------------+ |   |                                           |
| +--------------------------------------+ |   |            [ Continue  -> ]               |
| | [+] Create an Organization         > | |   |                                           |
| |     Set up a new workspace           | |   | Already have an account? Sign in          |
| +--------------------------------------+ |   +-------------------------------------------+
|                                          |
| Already have an account? Sign in         |
+------------------------------------------+
```

Glyphs above are placeholders for the sketch. Ship inline 24x24 stroke SVGs in the same style as
the existing `highlight-icon` paths — `stroke-width="1.6"`, `stroke-linecap="round"`. No emoji in
markup.

### Cards, not a radio list

Three options, each with a one-line "is this me?" subtitle. Cards beat a `<select>` or a plain
radio list here because the subtitle is the deciding information and must be visible without
interaction. Keep to the three launch types; Partner / Vendor / Contractor must not appear until
they are implemented — an empty or disabled fourth card reads as broken.

If the server later restricts `registrationTypes` to one entry, **skip the pre-step entirely**
and go straight to that type's step 1 with no chip. A one-option chooser is a dead click.

---

## 3. Per-type flows

Card header copy changes per type; the left showcase panel (brand, headline, highlights, stats,
device) stays identical across all three. Swapping the showcase per type would make the page feel
like three different products.

### 3.1 Join an Organization — 2 steps

| Step | Legend | Fields |
|---|---|---|
| 1 | Organization | Organization, First name, Last name, Work email |
| 2 | Security | Password, Confirm password, Terms |

Kicker `GET STARTED` · Title `Create your **account**` · Lead "Join your organization's workspace
on Zellavora Control Center."

Terminal state: **Pending approval** (section 5).

Do **not** add Department / Branch / Role / Group to this form. Step 8 of the proposal puts those
on the approver, and that is right: the registrant usually guesses them wrong, and every guess
becomes a correction in the approval queue. The approval screen in `/iam/user-requests` is where
they belong, as required fields before Approve enables.

### 3.2 Individual — 2 steps

| Step | Legend | Fields |
|---|---|---|
| 1 | Your details | First name, Last name, Email |
| 2 | Security | Password, Confirm password, Terms |

Kicker `GET STARTED` · Title `Create your **account**` · Lead "A personal account, ready in a
minute. No organization needed."

No organization, department, branch, employee code, role or group field appears — not disabled,
not hidden-but-present. The step-1 email label is "Email" with placeholder `you@example.com`
(not "Work email" / `name@company.com`).

Terminal state: **Verify your email** (section 5).

### 3.3 Create an Organization — 3 steps

| Step | Legend | Fields |
|---|---|---|
| 1 | Organization | Organization name, Organization code, Business email, Country, Time zone |
| 2 | Administrator | First name, Last name, Work email |
| 3 | Security | Password, Confirm password, Terms |

Kicker `NEW WORKSPACE` · Title `Create your **organization**` · Lead "Set up a new workspace.
You'll be its first administrator."

Step 1 details:

- **Organization code** — auto-derive from the name (`Acme Robotics` to `acme-robotics`) into a
  field the user can still edit; show a `--auth-text-muted` hint "Used in your sign-in URL and
  invites." Validate shape inline; check availability on blur with a `role="status"` result line,
  never a blocking modal.
- **Country / Time zone** — `SelectControl` with `[searchable]="true"`. Pre-select from
  `Intl.DateTimeFormat().resolvedOptions().timeZone` and mark the pair "Detected — change if this
  isn't right." Two searchable 200-entry dropdowns with no default is the single most abandoned
  part of this flow.
- **Business email** — hint "Billing and account notices go here. Can differ from your own."

Step 2 shows an `Administrator` legend and a muted line "This is your personal login for
{Organization name}." — the two emails in this flow are the main source of user confusion.

Terminal state: **Organization request submitted** (section 5).

---

## 4. Stepper mechanics

The current stepper is hard-coded to two columns (`grid-template-columns: 1fr 1fr` in
`register.page.scss`) and must become step-count driven.

```scss
.stepper { grid-template-columns: repeat(var(--step-count, 2), minmax(0, 1fr)); }
```

with `[style.--step-count]="steps().length"` on the `<ol>`.

**Three steps at 375px will not fit three labels.** Below `480px`, or whenever
`steps().length > 2`, switch the stepper to compact mode: hide `.stepper__label` visually (keep
it in the accessible name), keep the numbered dots as a segmented bar, and add one line of text
above it:

```
Step 2 of 3 · Administrator
[========][========][        ]
```

This keeps the current step *named* — a bare "2 of 3" with no label is a regression from the
two-step version.

For 3+ steps, make the stepper block sticky inside `.card-inner` (`position: sticky; top: 0` with
the card's glass background) so progress stays visible while the card scrolls. The card already
handles overflow (`justify-content: safe center`, themed thin scrollbar).

### Step transitions

Keep `step-in` (0.35s, `cubic-bezier(.2,.8,.2,1)`) but make it direction-aware: forward slides in
from `+14px`, Back from `-14px`. Store direction in a signal set by `next()` / `back()`. Transform
and opacity only — never animate width/height. Extend the existing
`@media (prefers-reduced-motion: reduce)` block in `auth-showcase.scss` to neutralise `step-in`,
`rise` and the type-card hover lift.

Focus must move into the new step on every change. `register.page.ts` already does this correctly
via `afterNextRender` + `focusBoundControl()`; the per-type version must keep it, including the
pre-step to step 1 hand-off (focus the first field of step 1) and Change back to the pre-step
(focus the currently selected card).

---

## 5. Terminal states

One success panel is no longer enough — the three types end in genuinely different places, and
telling an individual user they are "awaiting approval" when they are not is a support ticket.
Reuse the `.done` block; vary icon, tone and copy.

| Type | Icon | Tone | Title | Body | Primary action |
|---|---|---|---|---|---|
| Individual | mail | cyan | Verify your **email** | "We sent a link to **{email}**. Open it to activate your account." | Resend verification |
| Join Organization | shield-check | violet | Awaiting **approval** | "Your request for **{email}** is with your administrators. We'll email you when it's approved." plus "A verification link was also sent." | Go to sign in |
| Create Organization | building-plus | emerald | Organization **submitted** | "**{Organization name}** is awaiting review by the Zellavora team. Verify your email meanwhile — we'll be in touch at **{businessEmail}**." | Go to sign in |

Each panel keeps a secondary link to the other action (sign in / resend) and does not dead-end.

---

## 6. Accessibility (WCAG 2.2 AA)

The current page is already strong here — skip link, `aria-current="step"`, `sr-only` step counts,
`focus-visible` rings, labelled fields. Carry all of it forward, and add:

- **Type cards** — a real `<fieldset>` with a visually-hidden `<legend>` ("How will you use
  Zellavora?") and visually-hidden `<input type="radio">` inside `<label>` cards. Native
  semantics, native arrow-key selection and native required-group validation, for free. Prefer
  this over a hand-rolled `role="radiogroup"` with roving tabindex; the custom version only earns
  its keyboard code if the cards later need to be non-form controls.
- **Not colour-only** — the selected card carries a 2px `--rt-accent` border **and** a check glyph
  in the corner **and** the native checked state. SC 1.4.1.
- **Targets** — type cards `min-height: 4.5rem`; the chip's "Change" button, like
  `.step-summary__edit`, keeps `min-height: 2.75rem`. SC 2.5.8.
- **Step legends** — wrap each step's fields in `<fieldset>` with a visually-hidden `<legend>`
  matching the step label. The existing `aria-label` on `<form>` covers part of this; the legend
  is what screen readers announce per group.
- **Errors** — keep per-field inline errors; the form-level `app-auth-alert` needs `role="alert"`
  so a failed submit is announced. SC 4.1.3.
- **Autocomplete** — `organization` on organization name, `country-name`, `email`, `given-name`,
  `family-name`, `new-password`. SC 1.3.5.
- **Redundant entry** (SC 3.3.7) — on Back, every field keeps its value; the signal `model()`
  already guarantees this. Never clear a step on reverse navigation. When the user switches type,
  keep shared values (first/last name, email, password) and drop only the type-specific ones.
- **Consistent help** (SC 3.3.6) — the support email from `/auth/config` appears in the same place
  in every terminal state.

---

## 7. Deep links and recovery

Sync the chosen type to the URL: `/auth/register?type=individual`. This makes browser Back step
out of a wizard sensibly, makes the flow linkable ("Join Acme on ZCC" to
`?type=organization_member&org=acme` pre-fills and locks the organization field), and lets an
unsupported `type` value fall back to the pre-step instead of a blank card.

Replace the query param on step changes rather than pushing history, so Back exits the type, not
the step. In-card Back handles steps.

---

## 8. Two UX problems in the current page this design should fix

1. **The organization dropdown lists every active tenant.** `GET /auth/clients` feeding a
   searchable select means turning on self-registration publishes your customer list — the review
   flags this as a multi-tenant defect, and it is also poor UX: a stranger scrolling a list of
   companies looking for theirs. Replace it with a typed **organization code** field that resolves
   the name on blur ("Acme Robotics" with a check glyph), and keep the picker only when the
   per-organization config in the proposal says directory listing is allowed. Progressive
   disclosure — and the invite link in section 7 means most users never type it.
2. **The approval email goes to the registrant, not the approvers.** No UI can compensate for
   this; it is proposal step 9 and belongs with the backend work. Until it lands, the "Awaiting
   approval" panel should not promise "your administrators have been notified" — say "is with your
   administrators" as in section 5.

---

## 9. Files

New, in `apps/zcc-frontend/src/app/features/auth/`:

```
ui/registration-type-cards.component.{ts,html,scss}   # fieldset + radio cards, signal-forms bound
ui/registration-type-chip.component.{ts,html,scss}    # selected type + Change
pages/register/steps/org-member-steps.component.ts    # step panes per type
pages/register/steps/individual-steps.component.ts
pages/register/steps/create-org-steps.component.ts
pages/register/registration-types.ts                  # type enum, labels, copy, icons, step lists
```

Changed:

```
pages/register/register.page.ts     # type signal, computed steps(), conditional schema, query-param sync
pages/register/register.page.html   # pre-step, chip, dynamic stepper, 3 terminal panels
pages/register/register.page.scss   # --step-count stepper, compact mode, sticky stepper, type cards
ui/auth-showcase.scss               # reduced-motion coverage for new animations
shared/models/auth.model.ts         # RegisterRequest: registrationType, optional clientCode/organization
core/auth/auth.service.ts           # config() -> registrationTypes
```

`RegisterRequest` is currently
`{ clientCode, firstName, lastName, email, password, acceptTerms: true }` with `clientCode`
required — it must become a discriminated union on `registrationType` so the compiler stops an
individual registration from carrying a `clientCode`.

**Blocking dependency:** steps 1, 3 and 4 of the proposal (enum plus migration, conditional
`RegisterSchema`, split service handlers) must land before this UI can submit anything but
`ORGANIZATION_MEMBER`. The pre-step, chip, dynamic stepper and per-type panes can be built and
unit-tested against the existing endpoint first, with the other two types gated behind
`registrationTypes` from `/auth/config`.

---

## 10. Pre-delivery checklist

- [ ] Inline SVG icons only, 24x24 viewBox, `stroke-width="1.6"` — no emoji
- [ ] `cursor: pointer` on type cards and the Change button
- [ ] Hover is colour / border / shadow — no scale transform that shifts the card grid
- [ ] `focus-visible` ring (`--auth-accent`, 2px, 2px offset) on cards, Change, Back, submit
- [ ] Submit disabled plus spinner while `form().submitting()`
- [ ] 375 / 768 / 1024 / 1440, and `max-height: 860px` laptops (the page has rules for this)
- [ ] No horizontal scroll with the 3-step stepper at 375px
- [ ] `prefers-reduced-motion` neutralises step-in, rise and card hover
- [ ] Every step reachable and completable by keyboard alone; focus lands in the new step
- [ ] Back preserves all input; switching type preserves shared input

---

## 11. Implementation status (2026-10-04)

Built and verified: backend typecheck clean, 46 backend tests passing, frontend
production build clean.

### Shipped

**Backend**
- `RegistrationType` enum, `users.registration_type`, and per-organization
  `allow_self_registration` / `allowed_registration_types` /
  `require_admin_approval` / `require_email_verification`
  (`prisma/migrations/20261004120000_registration_types`).
- `RegisterSchema` is a discriminated union on `registrationType`; a missing
  type is read as `ORGANIZATION_MEMBER` so already-deployed clients keep working.
- `register()` dispatches to `registerOrganizationMember`, `registerIndividual`
  and `registerOrganizationOwner`.
- `GET /auth/config` returns `registrationTypes`, empty when registration is off.
- `NEW_ORGANIZATION` request type, `onOrganizationRegistration`, and
  `activateOrganization` provisioning.
- **Proposal step 9 fixed**: `APPROVAL_REQUIRED` now goes to resolved approvers
  (org owners/admins, or platform admins for a new organization) and the
  registrant gets `SUBMITTED`. A request with no reachable approver is logged as
  a warning rather than silently emailing nobody.

**Frontend**
- Type chooser pre-step, changeable chip, step-count-driven stepper with compact
  mode, direction-aware transitions, three terminal panels, `?type=` deep links.
- Conditional validation via `hidden({ when })`: a hidden field drops out of
  parent validity, so the form validates exactly the chosen type's fields.
- `RegisterRequest` is a discriminated union client-side too.

### Deviations from the spec above

1. **Controls.** All fields use `app-form-input-control` from `@zellavoras/ui`
   (one control covering text, email, password and searchable select) instead of
   `app-auth-field` + `app-select-control`. Consequences: its `SelectOption` has
   no `description`, so the organization code and the time-zone offset are folded
   into the option label; search turns on automatically past `searchThreshold`
   rather than via `[searchable]`.
2. **`autocomplete` is not wired.** `app-form-input-control` exposes no
   `autocomplete` input, so SC 1.3.5 (§6) is unmet on this form — the previous
   `app-auth-field` did set it. Worth adding to the library.
3. **The chooser is not form-bound.** It is a mode with no valid way to skip it,
   so there is nothing to validate; it takes `[value]` and emits `(chosen)`.
4. **New organizations are created immediately** in `pending_verification` and
   activated on approval, rather than being created at approval time. The
   membership and the approval request need a real row to point at, and
   `TenantService.listActive` already excludes a pending organization, so it is
   not a sign-in target.
5. **`audit_logs.organization_id` is now nullable.** An individual account
   belongs to no organization. Every reader already treated it as an optional
   filter, so org-scoped queries are unchanged.

### Follow-up completed

- **§8.1:** the anonymous `GET /auth/clients` directory was removed. Sign-in now
  accepts a typed organization code; registration uses a separate list containing
  only organizations that explicitly enabled member self-registration.
- Settings now includes a Registration tab backed by the audited, permission-gated
  per-organization settings endpoint. Existing organizations remain closed until an
  administrator opts in.
- New-organization codes are checked on blur, with submit-time uniqueness remaining
  authoritative.
- Playwright covers the member, individual, and create-organization flows.
- The final approver must assign Department, Branch, and at least one Role through a
  constrained, audited placement action before Approve becomes available.
