# Portfolio and projects

A personal portfolio (profile, hero, about, skills, experience, education, services, testimonials) and a project showcase with gallery images and technology tags. This is the oldest part of the backend: inline route handlers in `routes/`, mostly backed by Supabase tables rather than Prisma.

## Code

| Layer                      | Path                                                                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projects                   | `apps/backend/src/routes/projects.ts` (Prisma `PortfolioProject`)                                                                                                                                                |
| Gallery                    | `apps/backend/src/routes/gallery.ts` (Supabase `project_gallery`, `projects`)                                                                                                                                    |
| Technologies               | `apps/backend/src/routes/technologies.ts` (Supabase `technologies`, `project_technologies`)                                                                                                                      |
| Portfolio                  | `apps/backend/src/routes/portfolio.ts` (Supabase `profiles`, `skills`, `experience`, `education`, `services`, `testimonials`)                                                                                    |
| Schema for Supabase tables | `apps/backend/supabase/migrations/0001_init_schema.sql`                                                                                                                                                          |
| Frontend portfolio         | `features/portfolio/` (`portfolio` shell; `profile-editor`, `hero-section`, `about-section`, `skills-manager`, `education-section`, `services-section`, `testimonials-section`; `services/portfolio.service.ts`) |
| Frontend projects          | `features/projects/` (`projects-list`, `project-editor`), `core/api/project.api.ts`, `core/repositories/project.repository.ts`                                                                                   |

## Projects API

Base path `/api/v1/projects`.

| Method | Path                           | Guard             | Purpose                                                                                      |
| ------ | ------------------------------ | ----------------- | -------------------------------------------------------------------------------------------- |
| GET    | `/`                            | optional sign-in  | Signed in: the organization's projects (filter `status`); anonymous: published projects only |
| GET    | `/slug/:slug`, `/:id`          | Public            | One project                                                                                  |
| POST   | `/`                            | `projects:create` | Create                                                                                       |
| PUT    | `/:id`                         | `projects:write`  | Update                                                                                       |
| DELETE | `/:id`                         | `projects:delete` | Delete                                                                                       |
| POST   | `/:id/publish`, `/:id/archive` | `projects:write`  | Change status                                                                                |

## Gallery and technologies API

Mounted at `/api/v1`.

| Method            | Path                                                 | Guard                                 |
| ----------------- | ---------------------------------------------------- | ------------------------------------- |
| GET               | `/projects/:projectId/gallery`                       | Public                                |
| POST, PUT, DELETE | `/projects/:projectId/gallery[/:imageId]`            | signed in (project ownership checked) |
| GET               | `/technologies`, `/projects/:projectId/technologies` | Public                                |
| POST              | `/technologies`                                      | signed in                             |
| POST, PUT, DELETE | `/projects/:projectId/technologies[/:technologyId]`  | signed in                             |

## Portfolio API

Mounted at `/api/v1` (not `/api/v1/portfolio`).

| Method            | Path                                                                                                             | Guard                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| GET               | `/profile?userId=…`, `/skills`, `/experience`, `/education`, `/services`, `/testimonials` (each with `?userId=`) | Public                                 |
| PUT               | `/profile`                                                                                                       | signed in (own profile)                |
| POST, PUT, DELETE | `/skills[/:id]`, `/experience[/:id]`, `/education[/:id]`, `/services[/:id]`, `/testimonials[/:id]`               | signed in (rows filtered by `user_id`) |

## Data model

Prisma: `PortfolioProject` (organization, title, slug, description, content, category, status, cover and thumbnail, GitHub/demo/website links, view and download counts, `publishedAt`), `Project`, `Profile`. Supabase-only: `skills`, `experience`, `education`, `services`, `testimonials`, `technologies`, `project_technologies`, `project_gallery`.

## Frontend

| Route                                                                                             | Screen                  |
| ------------------------------------------------------------------------------------------------- | ----------------------- |
| `/portfolio` → `/portfolio/profile`                                                               | Profile editor          |
| `/portfolio/hero`, `/about`, `/skills`, `/experience`, `/education`, `/services`, `/testimonials` | Section editors         |
| `/projects`, `/projects/new`, `/projects/:id`                                                     | Project list and editor |

## Tests

`core/repositories/project.repository.spec.ts`. No backend tests for any route in this area.

## Review notes

- **The portfolio screens call endpoints that do not exist.** `portfolio.service.ts` requests `/api/v1/portfolio/profile`, `/api/v1/portfolio/skills` and so on, but the backend serves them at `/api/v1/profile`, `/api/v1/skills` (review **M13**). The tables those handlers read are defined only in `supabase/migrations`, not in the Prisma schema, so a Prisma-migrated database does not have them either.
- The frontend interceptor rewrites `/projects/:id/gallery` to `/gallery/projects/:id`, a path the backend does not serve (`core/http/api-base-url.interceptor.ts:59`).
- Update handlers pass `req.body` straight to Supabase (`.update(req.body)`), so owners can rewrite any column including `user_id`; any member can add global technologies (review **M2**).
- Projects use Prisma (`portfolio_projects`) while gallery and technologies reference the Supabase `projects` table. Project ids from one do not exist in the other.
- Recommendation: move this area into a `modules/portfolio` module on Prisma with Zod DTOs, or remove it if the portfolio is no longer a product goal.
