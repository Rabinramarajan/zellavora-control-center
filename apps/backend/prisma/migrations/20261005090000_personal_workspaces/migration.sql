-- Individual accounts get a private one-member workspace so they can hold a
-- role and sign in like everyone else.
ALTER TABLE "organizations" ADD COLUMN "is_personal" BOOLEAN NOT NULL DEFAULT false;

-- Navigation keys for pages that were previously shown to every member, plus
-- the project keys the projects API already checks.
INSERT INTO "permissions" ("id", "name", "key", "resource", "action", "description")
VALUES
  (gen_random_uuid(), 'read:portfolio',     'portfolio:read',     'portfolio',     'read',   'View and edit the portfolio'),
  (gen_random_uuid(), 'read:projects',      'projects:read',      'projects',      'read',   'View projects'),
  (gen_random_uuid(), 'create:projects',    'projects:create',    'projects',      'create', 'Create projects'),
  (gen_random_uuid(), 'write:projects',     'projects:write',     'projects',      'write',  'Edit projects'),
  (gen_random_uuid(), 'delete:projects',    'projects:delete',    'projects',      'delete', 'Delete projects'),
  (gen_random_uuid(), 'read:media',         'media:read',         'media',         'read',   'View the media library'),
  (gen_random_uuid(), 'read:cms',           'cms:read',           'cms',           'read',   'View CMS pages'),
  (gen_random_uuid(), 'manage:cms',         'cms:manage',         'cms',           'manage', 'Build and publish CMS pages'),
  (gen_random_uuid(), 'read:timesheet',     'timesheet:read',     'timesheet',     'read',   'Keep daily, monthly and time sheets'),
  (gen_random_uuid(), 'read:notifications', 'notifications:read', 'notifications', 'read',   'View your notifications')
ON CONFLICT DO NOTHING;

-- Existing roles keep seeing the pages that had no key until now.
INSERT INTO "role_permissions" ("id", "organization_id", "role_id", "permission_id", "effect")
SELECT gen_random_uuid(), r."organization_id", r."id", p."id", 'allow'
FROM "roles" r
JOIN "permissions" p ON p."key" IN (
  'portfolio:read', 'projects:read', 'media:read', 'cms:read', 'timesheet:read', 'notifications:read'
)
WHERE r."organization_id" IS NOT NULL AND r."is_deleted" = false
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
