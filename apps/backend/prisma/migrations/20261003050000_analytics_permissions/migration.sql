-- Analytics permissions: reading reports and exporting them.
INSERT INTO "permissions" ("id", "name", "key", "resource", "action", "description")
VALUES
  (gen_random_uuid(), 'read:analytics',   'analytics:read',   'analytics', 'read',   'View traffic analytics'),
  (gen_random_uuid(), 'export:analytics', 'analytics:export', 'analytics', 'export', 'Download analytics reports')
ON CONFLICT DO NOTHING;

-- Whoever can see the operations dashboard can see and export analytics.
INSERT INTO "role_permissions" ("id", "organization_id", "role_id", "permission_id", "effect")
SELECT gen_random_uuid(), rp."organization_id", rp."role_id", np."id", 'allow'
FROM "role_permissions" rp
JOIN "permissions" op ON op."id" = rp."permission_id" AND rp."effect" = 'allow'
JOIN "permissions" np ON np."key" IN ('analytics:read', 'analytics:export')
WHERE op."key" = 'dashboard:read'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
