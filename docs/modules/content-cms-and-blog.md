# Content: CMS pages and blog

Two tenant-scoped content tools. The **CMS** manages website pages assembled from sections in a visual builder, with SEO fields, scheduling and version history. The **blog** manages articles with categories, scheduling and duplication.

## Code

| Area   | Backend                                                                                    | Frontend                                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CMS    | `modules/cms/` (`cms.routes.ts`, `cms.service.ts`, `cms.repository.ts`, `cms.dto.ts`)      | `features/cms/` (`page-list`, `create-page-dialog`, `page-builder` with `canvas`, `component-library`, `property-panel`, `page-settings-panel`, `section-preview`) |
| Blog   | `modules/blog/` (`blog.routes.ts`, `blog.service.ts`, `blog.repository.ts`, `blog.dto.ts`) | `features/blog/` (`blog-list`, `blog-editor`), `core/api/blog.api.ts`                                                                                              |
| Shared | `middleware/org-context.ts` (`orgContextOf`)                                               | `core/api/cms-builder.api.ts`, `core/repositories/cms-builder.repository.ts`, `shared/models/cms-builder.model.ts`                                                 |

Both routers apply `authenticate` to every route, then `cms:read` / `cms:manage` or `blog:read` / `blog:manage`. Every query is filtered by the caller's organization, and every write is audited.

## CMS API

Base path `/api/v1/cms`.

| Method               | Path                                     | Permission    | Purpose                                                                                                            |
| -------------------- | ---------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| GET                  | `/pages`                                 | `cms:read`    | Search: `q`, `status`, `type`, paging, sort                                                                        |
| GET                  | `/pages/stats`                           | `cms:read`    | Counts by status                                                                                                   |
| GET                  | `/pages/slug-check`                      | `cms:read`    | Is a slug free (`slug`, `excludeId`)                                                                               |
| POST                 | `/pages`                                 | `cms:manage`  | Create: title, type, template, parent, slug                                                                        |
| GET / PATCH / DELETE | `/pages/:id`                             | read / manage | Read, update (title, meta title ≤70, meta description ≤160, SEO: canonical, noindex, nofollow, Open Graph), delete |
| GET / PUT            | `/pages/:id/builder`                     | read / manage | Load or save the section array (`sections`, `version`)                                                             |
| POST                 | `/pages/:id/publish`, `/unpublish`       | `cms:manage`  | Change visibility                                                                                                  |
| POST                 | `/pages/:id/schedule`                    | `cms:manage`  | Set `scheduledAt` and status `SCHEDULED`                                                                           |
| POST                 | `/pages/:id/duplicate`                   | `cms:manage`  | Copy                                                                                                               |
| GET                  | `/pages/:id/versions`                    | `cms:read`    | Revision list                                                                                                      |
| POST                 | `/pages/:id/versions/:versionId/restore` | `cms:manage`  | Restore a revision                                                                                                 |

Statuses: `DRAFT`, `IN_REVIEW`, `APPROVED`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`. Types: `STANDARD`, `LANDING`, `ARTICLE`, `SYSTEM`, `CUSTOM`.

## Blog API

Base path `/api/v1/blog`.

| Method               | Path                                 | Permission    | Purpose                       |
| -------------------- | ------------------------------------ | ------------- | ----------------------------- |
| GET                  | `/posts`                             | `blog:read`   | Search and filter             |
| GET                  | `/stats`, `/categories`              | `blog:read`   | Counts, category list         |
| POST                 | `/posts`                             | `blog:manage` | Create                        |
| GET / PATCH / DELETE | `/posts/:id`                         | read / manage | Read, update, delete          |
| POST                 | `/posts/:id/publish`                 | `blog:manage` | Publish now or at `publishAt` |
| POST                 | `/posts/:id/unpublish`, `/duplicate` | `blog:manage` | Unpublish, copy               |

Statuses: `DRAFT`, `PUBLISHED`, `SCHEDULED`, `ARCHIVED`. Scheduled posts whose time has passed are promoted to published when posts are next listed (`blog.repository.ts:35`).

## Data model

`CmsPage` (slug, status, type, template, parent, sections JSON, SEO fields, `publishedAt`, `scheduledAt`, version), `CmsPageRevision`, `BlogPost`.

## Frontend

| Route                                               | Permission                             | Screen                                                                      |
| --------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| `/cms`, `/cms/new`                                  | `cms:read`                             | Page list with stats; create dialog                                         |
| `/cms/:id/builder`                                  | `cms:read` (saving needs `cms:manage`) | Three-pane builder: component library, canvas, property and settings panels |
| `/blog`, `/blog/new`, `/blog/:id`, `/blog/:id/edit` | `blog:read`                            | Post list and editor                                                        |
| `/cms-builder`                                      |                                        | Redirect to `/cms`                                                          |

## Tests

`blog/blog.service.spec.ts`, `features/blog/*.spec.ts`, `features/cms-builder/*.spec.ts` (the unrouted predecessor). No backend tests for CMS and no specs for `features/cms`.

## Review notes

- There is no public read API: every route requires a signed-in user. A public website cannot fetch published pages or posts from this backend yet.
- CMS pages set to `SCHEDULED` never become `PUBLISHED`; nothing checks `scheduledAt`. Reuse the blog's promote-on-read approach or add a scheduled job.
- Builder `sections` are stored as free-form JSON (`z.record(z.unknown())`). Validate section types and properties before a public renderer consumes them, to keep stored markup from becoming an XSS path.
- `features/cms-builder/` only redirects; delete it.
