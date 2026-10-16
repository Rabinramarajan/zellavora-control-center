-- P0 security hardening.
-- New permission codes that gate routes which used to need no sign-in.
INSERT INTO "permissions" ("id", "name", "key", "resource", "action", "description")
VALUES
  (gen_random_uuid(), 'read:organizations',   'organizations:read',   'organizations', 'read',   'View your organization profile'),
  (gen_random_uuid(), 'update:organizations', 'organizations:update', 'organizations', 'update', 'Edit your organization profile and tighten its security settings')
ON CONFLICT DO NOTHING;

-- Every role that grants anything can already see its own organization.
INSERT INTO "role_permissions" ("id", "organization_id", "role_id", "permission_id", "effect")
SELECT gen_random_uuid(), r."organization_id", r."role_id", np."id", 'allow'
FROM (
  SELECT DISTINCT "organization_id", "role_id" FROM "role_permissions" WHERE "effect" = 'allow'
) r
JOIN "permissions" np ON np."key" = 'organizations:read'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Whoever manages settings can edit the organization profile.
INSERT INTO "role_permissions" ("id", "organization_id", "role_id", "permission_id", "effect")
SELECT gen_random_uuid(), rp."organization_id", rp."role_id", np."id", 'allow'
FROM "role_permissions" rp
JOIN "permissions" op ON op."id" = rp."permission_id" AND rp."effect" = 'allow'
JOIN "permissions" np ON np."key" = 'organizations:update'
WHERE op."key" = 'settings:manage'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- PermissionService no longer falls back to "the role named after users.role" for members with no
-- assignment. Turn that implicit grant into an explicit one so nobody loses access.
INSERT INTO "user_role_assignments" ("id", "user_id", "role_id", "organization_id", "resource_type", "resource_id")
SELECT gen_random_uuid(), m."user_id", r."id", m."organization_id", 'tenant', m."organization_id"::text
FROM "organization_members" m
JOIN "users" u ON u."id" = m."user_id" AND u."is_deleted" = false
JOIN "roles" r
  ON r."organization_id" = m."organization_id"
 AND lower(r."name") = lower(u."role")
 AND r."status" = 'ACTIVE'
 AND r."is_deleted" = false
WHERE NOT EXISTS (
  SELECT 1 FROM "user_role_assignments" a
  WHERE a."user_id" = m."user_id" AND a."organization_id" = m."organization_id"
);
