# Zellavora Control Center (ZCC)

Production-ready monorepo foundation for the Zellavora enterprise administration platform.

## Stack

- Angular 22 (standalone, signals, zoneless, SSR + hydration)
- Tailwind CSS
- Supabase placeholders (DB/migrations/seeds/storage/auth)
- Docker and GitHub Actions

## Repository Structure

- `apps/admin` - Angular admin app foundation
- `apps/portfolio` - placeholder app workspace
- `packages/*` - shared package placeholders (`ui`, `core`, `auth`, `shared`, `icons`, `utils`)
- `supabase/*` - database and platform placeholders
- `docker/` - containerization assets
- `docs/` - project documentation space

## Commands

```bash
npm install
npm run lint
npm run build
npm run test -- --watch=false
npm run start
```
