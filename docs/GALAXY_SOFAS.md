# Galaxy Sofas tenant

Imported from the real website and its existing public Blob content on 29 September 2026.

- Website: https://www.galaxysofas.com/
- Client code: `galaxy-sofas`
- Tenant ID: `9809684a-674b-4d13-a729-b2090a2d9924`
- Existing owner: `admin@zellavora.com` (existing password and original tenant membership preserved)
- Branch: Nerkundram Workshop & Showroom, No.19, Nerkundram, Chennai 600107, Tamil Nadu, India
- Content: 14 products, 8 categories, 6 services, 12 gallery entries, testimonials, page copy, contact details, business hours, navigation, SEO and UI text
- Media: 124 images and 1 MP4 video, 27,874,450 bytes, plus website content JSON

The source site's published files are unchanged. The tenant has independent copies under
`tenants/9809684a-674b-4d13-a729-b2090a2d9924/` in the existing public Blob store.
Images and video remain public website assets; management operations are authenticated
and limited to the active tenant's folder. The original Zellavora library remains accessible,
but it cannot access reserved tenant folders.

## Content storage

The tenant's `common_configurations` contains:

| Key | Contents |
| --- | --- |
| `website.content` | Complete source content with media URLs rewritten to the tenant copies |
| `website.source` | Source URL, import time and source content SHA-256 |
| `website.media` | Imported media paths, URLs, types, sizes and source URLs |
| `website.stores` | Real showroom/workshop contact information and business hours |
| `storage.blob` | Public storage prefix and content JSON URL; no credentials |

Read content through authenticated `GET /api/v1/organization-settings/website.content`.
The configuration record's `value` is a JSON string. Read media through
`GET /api/v1/storage/media`; follow `cursor` when `hasMore` is true.
An owner/admin can update configuration through the existing settings API.
The database content and Blob JSON are import snapshots: changing one does not
automatically update the other or redeploy the Galaxy Sofas website.

## Repeat the import

```powershell
npm run db:import:galaxy-sofas --prefix apps/backend
```

By default, the importer uses `galaxy-sofas-websites` beside the control-center
repository. If your website project is elsewhere, supply its folder after `--`:

```powershell
npm run db:import:galaxy-sofas --prefix apps/backend -- "D:/path/to/galaxy-sofas-websites"
```

Relative paths are resolved from the directory where you run the npm command.
The source project must have `.env.local` with its existing Blob token.
The control center must have `DATABASE_URL` in its normal local environment.
If there is more than one existing owner, set `GALAXY_OWNER_EMAIL` explicitly.
The importer uses a transaction for database records and an advisory lock to serialize
imports. Re-running preserves existing company data, content and media. It does not
overwrite edits, reset passwords, send invitations, or change the live source website.

The server-only tenant Blob credential is stored in ignored `apps/backend/.env.local`
and the backend project's Vercel Production/Preview secrets, under
`BLOB_READ_WRITE_TOKEN_9809684A_674B_4D13_A729_B2090A2D9924`.
Other environments need the same server-only connection before listing this tenant's media.

## Verification

Backend TypeScript checking and 15 targeted tests passed. Direct backend-service checks
confirmed tenant membership, preserved original tenant access, all five content records,
all 126 Blob entries, video delivery, and rejection of paths outside the tenant folder.

Deployment `dpl_hgyxfJVDmsix76aCcnYs12jibNgs` was promoted to the live `zcc-backend`
project after checking the hosted API: unauthenticated content access returns 401,
authenticated company content and all 126 media entries return 200, and access to
the source site's files outside the tenant prefix returns 403.
