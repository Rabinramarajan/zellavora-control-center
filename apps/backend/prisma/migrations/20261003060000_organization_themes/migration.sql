-- Themes become an organization-scoped library with one active theme per organization.
ALTER TABLE "themes"
  ADD COLUMN IF NOT EXISTS "organization_id" UUID,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "font_family" TEXT NOT NULL DEFAULT 'Outfit',
  ADD COLUMN IF NOT EXISTS "border_radius" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "logo_url" TEXT,
  ADD COLUMN IF NOT EXISTS "favicon_url" TEXT,
  ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "created_by" UUID,
  ADD COLUMN IF NOT EXISTS "updated_by" UUID,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- Names are unique per organization rather than globally.
DROP INDEX IF EXISTS "themes_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "themes_organization_id_name_key" ON "themes" ("organization_id", "name");
CREATE INDEX IF NOT EXISTS "themes_organization_id_is_deleted_idx" ON "themes" ("organization_id", "is_deleted");

-- Permissions: viewing the theme library and managing it.
INSERT INTO "permissions" ("id", "name", "key", "resource", "action", "description")
VALUES
  (gen_random_uuid(), 'read:themes',   'themes:read',   'themes', 'read',   'View the theme library'),
  (gen_random_uuid(), 'manage:themes', 'themes:manage', 'themes', 'manage', 'Create, edit, activate and delete themes')
ON CONFLICT DO NOTHING;

-- Roles that manage organization settings manage themes; dashboard viewers may browse them.
INSERT INTO "role_permissions" ("id", "organization_id", "role_id", "permission_id", "effect")
SELECT gen_random_uuid(), rp."organization_id", rp."role_id", np."id", 'allow'
FROM "role_permissions" rp
JOIN "permissions" op ON op."id" = rp."permission_id" AND rp."effect" = 'allow'
JOIN "permissions" np ON
     (op."key" = 'settings:write' AND np."key" IN ('themes:read', 'themes:manage'))
  OR (op."key" = 'dashboard:read' AND np."key" = 'themes:read')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
