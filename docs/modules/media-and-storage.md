# Media library and storage

A per-organization file library (images, video, audio, documents) organised in folders, used by the CMS, blog, themes and profiles. Files are stored in PostgreSQL (`media_files.data`), keyed by organization and path.

## Code

| Layer            | Path                                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend          | `apps/backend/src/modules/storage/` (`storage.routes.ts`, `storage.controller.ts`, `storage.service.ts`, `storage.repository.ts`, `storage.dto.ts`, `storage.types.ts`) |
| Frontend         | `apps/zcc-frontend/src/app/features/media/media.component.ts` (grid/list, folders, upload, preview, download, delete)                                                   |
| Shared uploaders | `shared/components/document-upload/` (`document-dropzone`, `document-upload`), `features/settings/components/avatar-uploader`                                           |

## API

Base path `/api/v1/storage` (alias `/api/v1/clean/storage`).

| Method | Path                     | Guard                                   | Purpose                                                                                         |
| ------ | ------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| GET    | `/media`                 | signed in                               | List the organization's files: `prefix` (folder), `cursor`, `limit` (≤1,000)                    |
| POST   | `/media`                 | `media:upload` or legacy `media:create` | Upload: `fileName`, `folder`, optional `mimeType`, `base64Data`                                 |
| DELETE | `/media?pathname=…`      | `media:delete`                          | Delete one file                                                                                 |
| GET    | `/media/file?pathname=…` | signed in                               | Stream a file (private cache, 5 min)                                                            |
| GET    | `/media/public/:id`      | Public                                  | Stream an image, video or audio file by id (public cache, 1 day); `?download=1` forces download |
| POST   | `/upload`                | **none**                                | Older base64 upload to local disk (see review)                                                  |

## Rules

- Decoded file size is capped at 3 MB so the base64 request stays under Vercel's 4.5 MB body limit.
- File and folder names reject `\ / ? # % :`; folders reject `.` and `..` segments.
- MIME type comes from the client or, if absent, from the extension. Images, video and audio are **public** by id; everything else (PDF, text, CSV, JSON, archives) is private and only streams to signed-in members of the organization.
- Every streamed file is sent with `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` and an explicit `Content-Disposition`, so an uploaded SVG or HTML file cannot run script.
- Paths are unique per organization (`@@unique([organizationId, pathname])`).

## Data model

`MediaFile`: organization, pathname, name, MIME type, size, `data` (bytes), timestamps.

## Frontend

`/media` (signed in): folder navigation, drag-and-drop upload, grid and list views, preview (images inline; PDFs and text through `blob:` object URLs in a frame), download, delete. Upload and delete buttons follow `media:upload` / `media:delete`.

## Tests

None for the storage module or the media page.

## Review notes

- **`POST /upload` has no authentication** and writes caller-supplied bytes to `./scratch/` on local disk (review **H2**). Delete it; `/media` is the supported path.
- Storing file bytes in PostgreSQL keeps backups simple but grows the database quickly and loads whole files into memory on every read. The health checker already expects Vercel Blob (`BLOB_READ_WRITE_TOKEN`); plan the move before libraries grow.
- `GET /media` and `/media/file` need only a sign-in, so every member can list and read private documents of their organization. Add a `media:read` permission if some documents should be restricted.
