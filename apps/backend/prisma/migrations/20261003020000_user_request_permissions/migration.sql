-- Granular User Request permissions, replacing the blanket users:read gate.
INSERT INTO "permissions" ("id", "name", "key", "resource", "action", "description")
VALUES
  (gen_random_uuid(), 'read:user-requests',         'user-requests:read',         'user-requests', 'read',         'Search and view user requests'),
  (gen_random_uuid(), 'create:user-requests',       'user-requests:create',       'user-requests', 'create',       'Raise new user requests'),
  (gen_random_uuid(), 'update:user-requests',       'user-requests:update',       'user-requests', 'update',       'Edit draft and sent-back user requests'),
  (gen_random_uuid(), 'submit:user-requests',       'user-requests:submit',       'user-requests', 'submit',       'Submit user requests for approval'),
  (gen_random_uuid(), 'cancel:user-requests',       'user-requests:cancel',       'user-requests', 'cancel',       'Cancel user requests'),
  (gen_random_uuid(), 'approve:user-requests',      'user-requests:approve',      'user-requests', 'approve',      'Approve user requests'),
  (gen_random_uuid(), 'reject:user-requests',       'user-requests:reject',       'user-requests', 'reject',       'Reject user requests'),
  (gen_random_uuid(), 'send-back:user-requests',    'user-requests:send-back',    'user-requests', 'send-back',    'Send user requests back for correction'),
  (gen_random_uuid(), 'retry:user-requests',        'user-requests:retry',        'user-requests', 'retry',        'Retry failed provisioning and emails'),
  (gen_random_uuid(), 'create:user-requests:notes', 'user-requests:notes:create', 'user-requests', 'notes:create', 'Add notes to user requests'),
  (gen_random_uuid(), 'read:user-requests:audit',   'user-requests:audit:read',   'user-requests', 'audit:read',   'View the audit trail of user requests')
ON CONFLICT DO NOTHING;

-- Preserve today's access: roles that could act through users:read / users:manage keep it.
INSERT INTO "role_permissions" ("id", "organization_id", "role_id", "permission_id", "effect")
SELECT gen_random_uuid(), rp."organization_id", rp."role_id", np."id", 'allow'
FROM "role_permissions" rp
JOIN "permissions" op ON op."id" = rp."permission_id" AND rp."effect" = 'allow'
JOIN "permissions" np ON
     (op."key" IN ('users:read', 'users:manage') AND np."key" IN (
        'user-requests:read', 'user-requests:create', 'user-requests:update',
        'user-requests:submit', 'user-requests:cancel', 'user-requests:notes:create'))
  OR (op."key" = 'users:manage' AND np."key" IN (
        'user-requests:approve', 'user-requests:reject', 'user-requests:send-back',
        'user-requests:retry', 'user-requests:audit:read'))
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
