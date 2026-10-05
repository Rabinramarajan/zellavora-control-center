-- INDIVIDUAL accounts now join the default organization instead of a personal
-- workspace. No personal workspace was ever created, so the flag can go.
ALTER TABLE "organizations" DROP COLUMN "is_personal";

-- The Individual role in zellavora-inc: personal-workspace permissions only.
INSERT INTO "roles" ("id", "name", "key", "organization_id", "description", "is_system", "created_at", "updated_at")
SELECT gen_random_uuid(), 'Individual', o."id" || '_individual', o."id",
       'Personal portfolio, content, projects and sheets only', true, now(), now()
FROM "organizations" o
WHERE o."client_code" = 'zellavora-inc'
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("id", "organization_id", "role_id", "permission_id", "effect")
SELECT gen_random_uuid(), r."organization_id", r."id", p."id", 'allow'
FROM "roles" r
JOIN "organizations" o ON o."id" = r."organization_id" AND o."client_code" = 'zellavora-inc'
JOIN "permissions" p ON p."key" IN (
  'dashboard:read', 'portfolio:read', 'projects:read', 'projects:create', 'projects:write',
  'projects:delete', 'blog:read', 'blog:manage', 'media:read', 'media:upload', 'media:delete',
  'cms:read', 'cms:manage', 'themes:read', 'themes:manage', 'analytics:read', 'analytics:export',
  'timesheet:read', 'notifications:read'
)
WHERE r."key" = o."id" || '_individual'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Existing INDIVIDUAL accounts that have no organization join zellavora-inc.
WITH org AS (SELECT "id" FROM "organizations" WHERE "client_code" = 'zellavora-inc'),
moved AS (
  UPDATE "users" u SET "tenant_id" = org."id", "role" = 'Individual'
  FROM org
  WHERE u."registration_type" = 'INDIVIDUAL' AND u."tenant_id" IS NULL
  RETURNING u."id" AS user_id, org."id" AS org_id
),
members AS (
  INSERT INTO "organization_members" ("user_id", "organization_id", "role", "is_default")
  SELECT user_id, org_id, 'member', true FROM moved
  ON CONFLICT DO NOTHING
)
INSERT INTO "user_role_assignments" ("id", "user_id", "role_id", "organization_id", "resource_type", "resource_id")
SELECT gen_random_uuid(), m.user_id, r."id", m.org_id, 'tenant', m.org_id::text
FROM moved m
JOIN "roles" r ON r."key" = m.org_id || '_individual';
