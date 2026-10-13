# Portfolio API: frontend handoff

Status: backend complete and verified. Owner API under `/api/v1/portfolio`, public read under `/api/v1/public/portfolios/{username}`.

This document is the contract for the Portfolio screens in `zcc-frontend`: the sidebar entries Profile, Hero, About, Skills, Experience, Education, Services and Testimonials. It was written from the backend, so every field name, status code and limit below matches the running code and the live Swagger document at `/swagger/swagger.json`.

## 1. What changed

| Before | Now |
| --- | --- |
| Supabase tables (`profiles`, `skills`, `experience`, `education`, `services`, `testimonials`), `user_id` / `order_index` columns | Prisma tables `portfolio_*`, owner and tenant scoped, camelCase JSON |
| `POST`/`PUT` passed `req.body` straight to Supabase (any column writable) | Strict Zod schemas; unknown keys return 400 |
| Path `/api/v1/experience` (singular) | `/api/v1/portfolio/experiences` (plural, like the other sections) |
| Routes mounted at the `/api/v1` root (`/api/v1/profile`, `/api/v1/skills`, …) | Everything under `/api/v1/portfolio`. The root paths return 404. |
| No public read | `GET /api/v1/public/portfolios/{username}` for a published portfolio |
| Writes gated by `portfolio:read` | Reads need `portfolio:read`, writes need `portfolio:manage` |

Existing data is not moved automatically. If the Supabase tables hold real portfolio content, it needs a one-off import into the `portfolio_*` tables before the Supabase tables are dropped. That import has not been done.

## 2. Base URLs and auth

- Owner API: `https://<api>/api/v1/portfolio`. Send `Authorization: Bearer <accessToken>` from `POST /api/v1/auth/login`. Refresh is the existing auth flow.
- Member mirror: `/api/app/portfolio` serves the same routes for the member app.
- Public API: `https://<api>/api/v1/public/portfolios/{username}`. No auth. Do not send a token.

Every owner route is scoped to the signed-in user inside their tenant. A user can never read or change another user's rows. Another user's row id returns 404, never 403.

## 3. Permissions

| Permission | Covers | Granted to |
| --- | --- | --- |
| `portfolio:read` | All `GET` routes | Owner, Admin, User (member), Individual |
| `portfolio:manage` | All `POST`, `PUT`, `DELETE` routes | Owner, Admin, User (member), Individual |

The Owner role has `*:*` and passes every check. A user without `portfolio:manage` gets `403 FORBIDDEN_PERMISSION` on writes and can still read. Hide write controls when the user lacks the permission, and still handle 403 gracefully, because permissions can change while a page is open.

## 4. Response envelope and errors

Success:

```json
{ "success": true, "data": { } }
```

Deletes return `204` with no body. Object responses also carry a `msg` block from the global response envelope. Ignore it.

Errors:

```json
{
  "error": {
    "message": "Invalid dates",
    "code": "INVALID_DATE_RANGE",
    "status": 400,
    "fields": { "endDate": "End date must be on or after the start date" }
  },
  "msg": { }
}
```

`fields` appears on validation errors, keyed by the request field name. Show each message next to its input. Only the first message per field is returned.

| HTTP | `error.code` | When | Frontend action |
| --- | --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Bad or unknown field, bad URL, bad date format, bad level or rating | Show `fields` inline |
| 400 | `INVALID_DATE_RANGE` | End before start, or a current role with an end date | Show `fields.endDate` |
| 400 | `PORTFOLIO_REORDER_INVALID` | Reorder list is not exactly the set of live items | Reload the list, then retry |
| 401 | `NO_TOKEN`, `SESSION_REVOKED`, `UNAUTHORIZED` | Missing, expired or revoked session | Use the normal auth-expiry flow |
| 403 | `FORBIDDEN_PERMISSION` | Caller lacks `portfolio:read` or `portfolio:manage` | Hide or disable write controls |
| 404 | `PORTFOLIO_ITEM_NOT_FOUND` | Unknown id, malformed id, deleted item, or another user's item | Reload the list |
| 404 | `PORTFOLIO_NOT_FOUND` | Public read: unknown username or not published | Show "not found" |
| 409 | `PORTFOLIO_LIMIT_REACHED` | Section already holds 100 live items | Disable the add button at 100 |
| 429 | (rate limit body) | Public read over 120 requests per minute per IP | Back off and retry later |

## 5. Save model

- Every section is saved with `PUT`, and every `PUT` is a partial update. Send only the fields that changed, or the whole form. Omitted fields keep their stored value.
- Send `""` or `null` to clear an optional field. Blank strings are stored as `null`.
- Unknown keys are rejected with 400. Do not send `id`, `userId`, `createdAt`, `sortOrder` or anything else not documented here.
- Profile, Hero and About share one stored row. Saving Hero does not change Profile fields, and the reverse is also true.
- There is no optimistic-locking version. The last save wins per section.

## 6. Endpoints

All owner routes take `Authorization: Bearer <token>`.

### Profile, Hero and About (singletons)

| Method | Path | Permission | Body | Returns |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/portfolio/profile` | read | none | `ProfileDto`. Empty values and `updatedAt: null` before the first save. |
| PUT | `/api/v1/portfolio/profile` | manage | `ProfileUpdate` (partial) | Updated `ProfileDto` |
| GET | `/api/v1/portfolio/hero` | read | none | `HeroDto` |
| PUT | `/api/v1/portfolio/hero` | manage | `HeroUpdate` (partial) | Updated `HeroDto` |
| GET | `/api/v1/portfolio/about` | read | none | `AboutDto` |
| PUT | `/api/v1/portfolio/about` | manage | `AboutUpdate` (partial) | Updated `AboutDto` |

### Collections: Skills, Experiences, Education, Services, Testimonials

Each collection supports the same five operations. `{section}` is one of `skills`, `experiences`, `education`, `services`, `testimonials`.

| Method | Path | Permission | Body | Returns |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/portfolio/{section}` | read | none | Array of live items in display order |
| POST | `/api/v1/portfolio/{section}` | manage | Create body | `201` with the created item, appended last |
| PUT | `/api/v1/portfolio/{section}/reorder` | manage | `{ "ids": [uuid, …] }` | Array in the new order |
| PUT | `/api/v1/portfolio/{section}/{id}` | manage | Partial body | Updated item |
| DELETE | `/api/v1/portfolio/{section}/{id}` | manage | none | `204` (soft delete) |

`reorder` is its own operation, not an item id. Send the reorder list to `PUT /{section}/reorder`, never to `PUT /{section}/{id}`.

### Public read

| Method | Path | Auth | Returns |
| --- | --- | --- | --- |
| GET | `/api/v1/public/portfolios/{username}` | none | `PublicPortfolio` (below) |

## 7. Data shapes

All dates in responses are `YYYY-MM-DD`. All timestamps are ISO 8601 UTC. Nullable fields are `string | null` in responses and may be omitted or sent as `null` in requests.

```ts
// Profile section. Also the `profile` block of the public response.
interface ProfileDto {
  isPublic: boolean;          // default false. When false, the public read returns 404.
  displayName: string | null; // max 120
  headline: string | null;    // max 160
  location: string | null;    // max 120
  email: string | null;       // valid email, max 254
  phone: string | null;       // + optional, digits, spaces, ( ) -, 6 to 30 chars
  website: string | null;     // http(s) URL, max 500
  github: string | null;      // http(s) URL, max 500
  linkedin: string | null;    // http(s) URL, max 500
  twitter: string | null;     // http(s) URL, max 500
  avatarUrl: string | null;   // http(s) URL, max 1000
  resumeUrl: string | null;   // http(s) URL, max 1000
  updatedAt: string | null;
}

interface HeroDto {
  greeting: string | null;            // max 80
  title: string | null;               // max 160
  subtitle: string | null;            // max 400
  primaryCtaLabel: string | null;     // max 40
  primaryCtaUrl: string | null;       // see "CTA URLs" below, max 500
  secondaryCtaLabel: string | null;   // max 40
  secondaryCtaUrl: string | null;     // see "CTA URLs" below, max 500
  imageUrl: string | null;            // http(s) URL, max 1000
  updatedAt: string | null;
}

interface AboutDto {
  body: string | null;      // max 10000, plain text
  imageUrl: string | null;  // http(s) URL, max 1000
  updatedAt: string | null;
}

interface SkillDto {
  id: string;
  name: string;             // required, 1 to 60
  category: string | null;  // max 60
  level: number | null;     // integer 0 to 100
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ExperienceDto {
  id: string;
  role: string;             // required, max 160
  company: string;          // required, max 160
  location: string | null;  // max 120
  startDate: string;        // required, YYYY-MM-DD
  endDate: string | null;   // YYYY-MM-DD, must be on or after startDate
  isCurrent: boolean;       // default false. When true, endDate must be null.
  description: string | null; // max 4000
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface EducationDto {
  id: string;
  institution: string;      // required, max 160
  degree: string;           // required, max 160
  field: string | null;     // max 160
  grade: string | null;     // max 60, free text such as "8.9 CGPA"
  startDate: string;        // required, YYYY-MM-DD
  endDate: string | null;   // YYYY-MM-DD, must be on or after startDate
  description: string | null; // max 2000
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ServiceDto {
  id: string;
  title: string;            // required, max 120
  description: string | null; // max 1000
  icon: string | null;      // max 40, lowercase key matching ^[a-z0-9-]+$
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface TestimonialDto {
  id: string;
  authorName: string;       // required, max 120
  authorRole: string | null; // max 160
  company: string | null;   // max 160
  quote: string;            // required, max 1000
  avatarUrl: string | null; // http(s) URL, max 1000
  rating: number | null;    // integer 1 to 5
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface PublicPortfolio {
  username: string;
  profile: ProfileDto;      // same shape as the owner response
  hero: HeroDto;
  about: AboutDto;
  skills: SkillDto[];
  experiences: ExperienceDto[];
  education: EducationDto[];
  services: ServiceDto[];
  testimonials: TestimonialDto[];
}
```

Create bodies are the same as the item shapes without `id`, `sortOrder`, `createdAt` and `updatedAt`. Required fields on create: `name` (skill), `role` and `company` and `startDate` (experience), `institution` and `degree` and `startDate` (education), `title` (service), `authorName` and `quote` (testimonial). Update bodies are the same as create bodies with every field optional.

### URL rules

- Profile links, avatars and images: `http://` or `https://` only. `javascript:` and bare domains are rejected.
- Hero CTA URLs: `https://`, `http://`, `mailto:`, or an in-app path starting with a single `/`. Protocol-relative `//host` is rejected.

## 8. Ordering, limits and deletion

- Each collection is capped at 100 live items. The 101st create returns 409. Show a counter such as "12 / 100".
- New items go to the end of their list.
- Reorder sends the full list of live ids in the new order. The list must contain each live id exactly once. A partial list returns 400 and changes nothing.
- Delete is a soft delete. The item disappears from every read, and its id stops resolving.
- There is no pagination. The maximum is 100 items per section, so the list endpoints return everything.

## 9. Dates

- Send and read dates as `YYYY-MM-DD`. Do not send timestamps.
- Validation checks that the date exists (`2026-02-30` is rejected).
- On update, the server validates the merged range. Example: a stored role ends `2024-06-30`, and a PATCH sets `startDate` to `2025-01-01` without changing `endDate`. The server returns `INVALID_DATE_RANGE`.
- To mark a role as current, send `isCurrent: true` and `endDate: null` in the same request.

## 10. Public read

- `GET /api/v1/public/portfolios/{username}` returns the newest public profile for that username. A profile is public when `isPublic` is `true`.
- Unknown and unpublished usernames both return 404 with `PORTFOLIO_NOT_FOUND`, so the response does not reveal which usernames exist.
- Responses include `Cache-Control: public, max-age=60`. A change can take up to a minute to appear on the public page.
- Rate limit: 120 requests per minute per client IP. Responses over the limit return 429.
- The response contains only the public fields listed in section 7. Owner and tenant ids are never returned. Item ids (`id`) are returned, so they can be used as list keys.
- The username is the account's `username`. The portfolio API does not set or change it.

Publishing flow for the UI: a "Make public" switch on Profile that sends `PUT /profile` with `{ "isPublic": true }`, and a "View public page" link to the frontend route that renders the public read. The public page route is not part of this handoff. See section 13.

## 11. Implementation plan for the frontend

Do these in order. Each step can be merged on its own.

1. Remove the old portfolio calls. The frontend portfolio code is not in this repository snapshot (`apps/zcc-frontend` is untracked; review note M13 records the mismatch). Any call that uses the old shapes must change: the singular `/experience` path, `user_id`, `order_index`, and snake_case fields. Use the paths and camelCase shapes above, and delete the mapping code that converted between the two.
2. Add a typed client, one service per section, that unwraps `data` from the envelope. Put the types from section 7 in `models/portfolio.model.ts`.
3. Build the Profile, Hero and About editors. Each one loads with its GET, binds a reactive form, and sends only dirty fields on save. Map `error.fields` to form controls. Keep the three editors independent: each one saves its own section.
4. Build the collection screens (Skills, Experience, Education, Services, Testimonials). Each has a list, an add dialog, an edit dialog, a delete confirmation and a drag handle. Drag end calls `PUT /{section}/reorder` with the full id list. On a 400 from reorder, reload the list and show a message.
5. Add the Profile visibility switch and the public page link (section 10).
6. Error handling: on 403, hide write controls. On 404 from an edit or delete, reload the list and tell the user the item is gone. On 409 from create, show the limit message. On 401, use the standard auth-expiry flow.
7. Empty states: each section has a short prompt to add its first item. Show the 100-item counter.
8. Tests. Unit tests for form-to-body mapping (blank to `null`, unchanged fields omitted) and for the date-range hint. Playwright E2E for: save a profile, add and reorder skills, add an experience with an invalid range and read the error, make the portfolio public and read it anonymously.

Form defaults for new items: `isCurrent` false, `level` empty (null), `rating` empty (null), `icon` empty (null).

## 12. Examples

Save the profile and make it public:

```http
PUT /api/v1/portfolio/profile
Authorization: Bearer <token>
Content-Type: application/json

{ "isPublic": true, "displayName": "Rabin R", "headline": "Full-stack engineer", "website": "https://rabin.dev", "twitter": "" }
```

```json
{
  "success": true,
  "data": {
    "isPublic": true,
    "displayName": "Rabin R",
    "headline": "Full-stack engineer",
    "location": null,
    "email": null,
    "phone": null,
    "website": "https://rabin.dev",
    "github": null,
    "linkedin": null,
    "twitter": null,
    "avatarUrl": null,
    "resumeUrl": null,
    "updatedAt": "2026-10-13T10:41:29.717Z"
  }
}
```

Reject an invalid range:

```http
POST /api/v1/portfolio/experiences
Authorization: Bearer <token>
Content-Type: application/json

{ "role": "Engineer", "company": "Acme", "startDate": "2024-05-01", "endDate": "2024-04-30" }
```

```json
{
  "error": {
    "message": "Invalid dates",
    "code": "INVALID_DATE_RANGE",
    "status": 400,
    "fields": { "endDate": "End date must be on or after the start date" }
  }
}
```

Reorder skills:

```http
PUT /api/v1/portfolio/skills/reorder
Authorization: Bearer <token>
Content-Type: application/json

{ "ids": ["36e227e3-557a-4f66-bc65-d3feb3c646ee", "17d00b71-9522-482f-b94a-567e3bf46665"] }
```

Anonymous public read:

```http
GET /api/v1/public/portfolios/rabin
```

## 13. Open questions and limits

- **Public page route.** The API is ready. Which frontend route serves the public page (and whether it lives in `zcc-frontend` or the future `apps/public`) is not decided.
- **Files.** Avatars, résumé, hero and about images are stored as URLs. The frontend uploads through the existing storage module (`/api/v1/storage`) and saves the returned URL. Upload UI is not part of this handoff.
- **Data import.** Existing Supabase portfolio rows are not imported. Decide whether to import them before the Supabase tables are removed.
- **Multiple tenants.** A profile row is keyed by tenant and user. If one user belongs to several tenants, the public read returns the most recently updated public profile.
- **Concurrency.** There is no version check. Two editors saving the same section will overwrite each other, last write wins.

## 14. Backend changes for reviewers

- New module: `apps/backend/src/modules/portfolio/` (DTOs, repository, service, owner routes, public routes, unit tests).
- Prisma: six `portfolio_*` models and back-relations on `User`. Migration `20261013120000_portfolio_module`. The migration also adds the `portfolio:manage` permission and grants it to every role that already has `portfolio:read`, so existing personal accounts keep editing after deploy.
- Removed: `apps/backend/src/routes/portfolio.ts` (the Supabase-backed router, mounted at the `/api/v1` root and at `/api/app/portfolio`).
- Swagger: removed the legacy Supabase portfolio schemas from `config/swagger.ts`. Added shared responses `Unauthorized`, `Forbidden`, `ValidationError`, `NotFound` and `LimitReached`.
- Seed: `portfolio:manage` added to the catalog and to member grants.
- Untouched: `apps/backend/supabase/functions/portfolio/index.ts` (the old Supabase edge function). Remove it with the Supabase tables.

Verification done:

- Typecheck (`tsc --noEmit`) passes for the backend.
- ESLint passes for `src/modules/portfolio`.
- Unit tests: 28 of 28 pass (`portfolio.service.spec.ts`, `portfolio.dto.spec.ts`).
- Full backend jest run: 519 of 522 tests pass across 44 suites. The 3 failures are in `src/routes/api-contract.spec.ts` (operation docs for audit-logs, IAM, invoices and `/api/v1/health`). The same 3 tests fail on the code before this change (baseline 491 of 494 passing). No portfolio route is among them.
- End to end: 49 of 49 checks pass against a Postgres 16 database with every migration applied and the schema diff empty. Checks cover auth, validation, date rules, reorder, cross-user isolation, the item cap, soft delete, the public read and its 404s, and the member mirror.
- Permissions: a member with `portfolio:manage` writes successfully. After the grant is revoked, writes return 403 and reads still return 200. After it is restored, writes succeed again.
- Audit: 117 `portfolio.*` audit events from the run, each carrying field names only, with no personal values.
