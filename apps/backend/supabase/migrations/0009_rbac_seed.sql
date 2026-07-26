-- =============================================================
-- 0009_rbac_seed.sql
-- Default system permissions, groups, roles, and hierarchy
-- Idempotent — safe to re-run
-- =============================================================

-- ---------- Permission Groups ----------
INSERT INTO permission_groups (key, label, icon, sort_order) VALUES
  ('user_management', 'User Management', 'users',  10),
  ('content',         'Content & CMS',   'file',   20),
  ('billing',         'Billing & Plans', 'card',   30),
  ('analytics',       'Analytics',       'chart',  40),
  ('security',        'Security & Audit','shield', 50),
  ('system',          'System',          'cog',    60)
ON CONFLICT (key) DO NOTHING;

-- ---------- System Permissions ----------
INSERT INTO permissions (key, type, label, group_id, is_system) VALUES
  -- User Management
  ('users:user:create',     'action', 'Create User',     (SELECT id FROM permission_groups WHERE key='user_management'), true),
  ('users:user:read',       'action', 'Read User',       (SELECT id FROM permission_groups WHERE key='user_management'), true),
  ('users:user:update',     'action', 'Update User',     (SELECT id FROM permission_groups WHERE key='user_management'), true),
  ('users:user:delete',     'action', 'Delete User',     (SELECT id FROM permission_groups WHERE key='user_management'), true),
  ('users:user:impersonate','action', 'Impersonate User',(SELECT id FROM permission_groups WHERE key='user_management'), true),
  ('users:role:create',     'action', 'Create Role',     (SELECT id FROM permission_groups WHERE key='user_management'), true),
  ('users:role:read',       'action', 'Read Role',       (SELECT id FROM permission_groups WHERE key='user_management'), true),
  ('users:role:update',     'action', 'Update Role',     (SELECT id FROM permission_groups WHERE key='user_management'), true),
  ('users:role:delete',     'action', 'Delete Role',     (SELECT id FROM permission_groups WHERE key='user_management'), true),
  ('users:role:assign',     'action', 'Assign Role',     (SELECT id FROM permission_groups WHERE key='user_management'), true),
  -- Content
  ('content:post:create',   'action', 'Create Post',     (SELECT id FROM permission_groups WHERE key='content'), true),
  ('content:post:read',     'action', 'Read Post',       (SELECT id FROM permission_groups WHERE key='content'), true),
  ('content:post:update',   'action', 'Update Post',     (SELECT id FROM permission_groups WHERE key='content'), true),
  ('content:post:delete',   'action', 'Delete Post',     (SELECT id FROM permission_groups WHERE key='content'), true),
  ('content:post:publish',  'action', 'Publish Post',    (SELECT id FROM permission_groups WHERE key='content'), true),
  -- Candidates / HR
  ('candidates:application:create', 'action', 'Create Application', (SELECT id FROM permission_groups WHERE key='user_management'), true),
  ('candidates:application:read',   'action', 'Read Application',   (SELECT id FROM permission_groups WHERE key='user_management'), true),
  ('candidates:application:update', 'action', 'Update Application', (SELECT id FROM permission_groups WHERE key='user_management'), true),
  ('candidates:offer:approve',      'action', 'Approve Offer',      (SELECT id FROM permission_groups WHERE key='user_management'), true),
  -- Billing
  ('billing:invoice:read',   'action', 'Read Invoice',   (SELECT id FROM permission_groups WHERE key='billing'), true),
  ('billing:invoice:create', 'action', 'Create Invoice', (SELECT id FROM permission_groups WHERE key='billing'), true),
  ('billing:plan:update',    'action', 'Update Plan',    (SELECT id FROM permission_groups WHERE key='billing'), true),
  -- System / Security
  ('system:rbac:read',    'action', 'Read RBAC Config', (SELECT id FROM permission_groups WHERE key='security'), true),
  ('system:rbac:write',   'action', 'Write RBAC Config',(SELECT id FROM permission_groups WHERE key='security'), true),
  ('system:audit:read',   'action', 'Read Audit Logs',  (SELECT id FROM permission_groups WHERE key='security'), true),
  ('system:tenant:write', 'action', 'Manage Tenant',    (SELECT id FROM permission_groups WHERE key='system'),   true),
  -- Features
  ('feature:analytics', 'feature', 'Analytics Module',  (SELECT id FROM permission_groups WHERE key='analytics'), true),
  ('feature:billing',   'feature', 'Billing Module',    (SELECT id FROM permission_groups WHERE key='billing'),   true),
  ('feature:reports',   'feature', 'Reports Module',    (SELECT id FROM permission_groups WHERE key='analytics'), true),
  ('feature:ai_assist', 'feature', 'AI Assist',         (SELECT id FROM permission_groups WHERE key='system'),    true),
  -- Screens
  ('screen:admin.dashboard',      'screen', 'Admin Dashboard', (SELECT id FROM permission_groups WHERE key='system'),         true),
  ('screen:admin.users.list',     'screen', 'Users List',      (SELECT id FROM permission_groups WHERE key='user_management'), true),
  ('screen:admin.users.detail',   'screen', 'User Detail',     (SELECT id FROM permission_groups WHERE key='user_management'), true),
  ('screen:admin.roles',          'screen', 'Roles Page',      (SELECT id FROM permission_groups WHERE key='user_management'), true),
  ('screen:admin.audit',          'screen', 'Audit Page',      (SELECT id FROM permission_groups WHERE key='security'),        true),
  ('screen:admin.billing',        'screen', 'Billing Page',    (SELECT id FROM permission_groups WHERE key='billing'),         true),
  -- Database
  ('db:projects:row.read.own',  'database', 'Read own projects',  (SELECT id FROM permission_groups WHERE key='system'), true),
  ('db:invoices:row.read.own', 'database', 'Read own invoices',  (SELECT id FROM permission_groups WHERE key='billing'), true)
ON CONFLICT (key) DO NOTHING;

-- ---------- System Roles ----------
INSERT INTO roles (organization_id, key, label, level, is_system, color, description) VALUES
  (NULL, 'super_admin',   'Super Admin',   100, true, '#ef4444', 'Unrestricted system administrator'),
  (NULL, 'org_owner',     'Org Owner',      90, true, '#dc2626', 'Organization owner with full org control'),
  (NULL, 'org_admin',     'Org Admin',      80, true, '#f59e0b', 'Organization administrator'),
  (NULL, 'manager',       'Manager',        60, true, '#3b82f6', 'Team / department manager'),
  (NULL, 'hr',            'HR',             50, true, '#a855f7', 'Human resources'),
  (NULL, 'finance',       'Finance',        50, true, '#10b981', 'Finance team'),
  (NULL, 'developer',     'Developer',      40, true, '#06b6d4', 'Software developer'),
  (NULL, 'support',       'Support',        35, true, '#84cc16', 'Customer support agent'),
  (NULL, 'recruiter',     'Recruiter',      45, true, '#ec4899', 'Hiring / talent acquisition'),
  (NULL, 'editor',        'Editor',         30, true, '#f97316', 'Content editor'),
  (NULL, 'viewer',        'Viewer',         10, true, '#64748b', 'Read-only viewer')
ON CONFLICT (organization_id, key) DO NOTHING;

-- ---------- Super Admin: every permission ----------
INSERT INTO role_permissions (role_id, permission_id, effect)
SELECT r.id, p.id, 'allow'::permission_effect
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'super_admin' AND r.organization_id IS NULL
ON CONFLICT DO NOTHING;

-- ---------- Org Admin: most things, except super-only ----------
INSERT INTO role_permissions (role_id, permission_id, effect)
SELECT r.id, p.id, 'allow'::permission_effect
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'org_admin' AND r.organization_id IS NULL
  AND p.key NOT IN ('system:tenant:write', 'users:user:impersonate')
ON CONFLICT DO NOTHING;

-- ---------- Manager ----------
INSERT INTO role_permissions (role_id, permission_id, effect)
SELECT r.id, p.id, 'allow'::permission_effect
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'manager' AND r.organization_id IS NULL
  AND p.key IN (
    'users:user:read', 'users:user:update',
    'users:role:read',
    'content:post:read', 'content:post:create', 'content:post:update',
    'feature:analytics', 'feature:reports',
    'system:audit:read', 'system:rbac:read',
    'screen:admin.dashboard', 'screen:admin.users.list'
  )
ON CONFLICT DO NOTHING;

-- ---------- HR ----------
INSERT INTO role_permissions (role_id, permission_id, effect)
SELECT r.id, p.id, 'allow'::permission_effect
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'hr' AND r.organization_id IS NULL
  AND p.key IN (
    'users:user:read', 'users:user:update', 'users:user:create',
    'candidates:application:create', 'candidates:application:read', 'candidates:application:update',
    'candidates:offer:approve',
    'feature:analytics'
  )
ON CONFLICT DO NOTHING;

-- ---------- Finance ----------
INSERT INTO role_permissions (role_id, permission_id, effect)
SELECT r.id, p.id, 'allow'::permission_effect
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'finance' AND r.organization_id IS NULL
  AND p.key IN (
    'billing:invoice:read', 'billing:invoice:create', 'billing:plan:update',
    'feature:billing', 'feature:reports', 'feature:analytics',
    'content:post:read',
    'screen:admin.billing'
  )
ON CONFLICT DO NOTHING;

-- ---------- Developer ----------
INSERT INTO role_permissions (role_id, permission_id, effect)
SELECT r.id, p.id, 'allow'::permission_effect
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'developer' AND r.organization_id IS NULL
  AND p.key IN (
    'users:user:read', 'content:post:read', 'content:post:create', 'content:post:update',
    'db:projects:row.read.own',
    'feature:ai_assist'
  )
ON CONFLICT DO NOTHING;

-- ---------- Support ----------
INSERT INTO role_permissions (role_id, permission_id, effect)
SELECT r.id, p.id, 'allow'::permission_effect
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'support' AND r.organization_id IS NULL
  AND p.key IN (
    'users:user:read',
    'content:post:read'
  )
ON CONFLICT DO NOTHING;

-- ---------- Recruiter ----------
INSERT INTO role_permissions (role_id, permission_id, effect)
SELECT r.id, p.id, 'allow'::permission_effect
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'recruiter' AND r.organization_id IS NULL
  AND p.key IN (
    'users:user:read',
    'candidates:application:create', 'candidates:application:read', 'candidates:application:update'
  )
ON CONFLICT DO NOTHING;

-- ---------- Editor ----------
INSERT INTO role_permissions (role_id, permission_id, effect)
SELECT r.id, p.id, 'allow'::permission_effect
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'editor' AND r.organization_id IS NULL
  AND p.key IN (
    'content:post:create', 'content:post:read', 'content:post:update', 'content:post:publish', 'content:post:delete'
  )
ON CONFLICT DO NOTHING;

-- ---------- Viewer ----------
INSERT INTO role_permissions (role_id, permission_id, effect)
SELECT r.id, p.id, 'allow'::permission_effect
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'viewer' AND r.organization_id IS NULL
  AND (p.key LIKE 'content:post:read' OR p.key LIKE 'users:user:read')
ON CONFLICT DO NOTHING;

-- ---------- Role Hierarchy ----------
INSERT INTO role_inheritance (role_id, parent_role_id)
SELECT child.id, parent.id
FROM roles child
JOIN roles parent ON parent.organization_id IS NULL
WHERE child.organization_id IS NULL
  AND (
    (child.key = 'org_owner'   AND parent.key = 'super_admin') OR
    (child.key = 'org_admin'   AND parent.key = 'org_owner')   OR
    (child.key = 'manager'     AND parent.key = 'org_admin')   OR
    (child.key = 'hr'          AND parent.key = 'manager')     OR
    (child.key = 'finance'     AND parent.key = 'manager')     OR
    (child.key = 'developer'   AND parent.key = 'manager')     OR
    (child.key = 'support'     AND parent.key = 'manager')     OR
    (child.key = 'recruiter'   AND parent.key = 'hr')          OR
    (child.key = 'editor'      AND parent.key = 'org_admin')   OR
    (child.key = 'viewer'      AND parent.key = 'editor')
  )
ON CONFLICT DO NOTHING;
