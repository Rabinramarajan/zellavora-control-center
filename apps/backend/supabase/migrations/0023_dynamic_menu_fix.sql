-- Dynamic menu runtime fix.
--
-- 1. Recreate v_user_effective_permissions on the CURRENT schema. The old view
--    (0004_enterprise_auth.sql) joined organization_members.role to roles.name
--    and referenced permissions.code — neither matches the live schema, where
--    effective access is expressed through user_role_assignments → roles →
--    role_permissions (effect='allow', granted=true) → permissions.key.
-- 2. Grant service_role on the menus family (same bug class as login_attempts:
--    supabaseAdmin queries fail with "permission denied").
-- 3. Seed a minimal menu tree for the seed organization.

-- ============================================================
-- 1. Effective permissions view
-- ============================================================

CREATE OR REPLACE VIEW public.v_user_effective_permissions AS
SELECT
  ura.user_id,
  ura.organization_id,
  p.key AS permission_code
FROM public.user_role_assignments ura
JOIN public.roles r
  ON r.id = ura.role_id
 AND r.is_deleted = false
JOIN public.role_permissions rp
  ON rp.role_id = r.id
 AND rp.organization_id = ura.organization_id
 AND rp.effect = 'allow'
 AND rp.granted = true
JOIN public.permissions p
  ON p.id = rp.permission_id
 AND p.enabled = true;

GRANT SELECT ON public.v_user_effective_permissions TO service_role;

-- ============================================================
-- 2. service_role grants on menu tables
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menus TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_usage TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_versions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_cache_state TO service_role;

-- ============================================================
-- 3. Seed menu tree for the seed organization
-- ============================================================

INSERT INTO menus (organization_id, key, label, icon, route, order_index, nesting_level, visible, required_permission, category)
SELECT
  'bf0d4e1c-a2d5-4027-861c-d724dd021e52', 'dashboard', 'Dashboard', '📊', '/dashboard', 10, 0, true, 'read:dashboard', 'main'
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO menus (organization_id, key, label, icon, route, order_index, nesting_level, visible, required_permission, category)
SELECT
  'bf0d4e1c-a2d5-4027-861c-d724dd021e52', 'projects', 'Projects', '💼', '/projects', 20, 0, true, NULL, 'main'
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO menus (organization_id, key, label, icon, route, order_index, nesting_level, visible, required_permission, category)
SELECT
  'bf0d4e1c-a2d5-4027-861c-d724dd021e52', 'settings', 'Settings', '⚙️', '/settings', 30, 0, true, 'write:settings', 'main'
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO menus (organization_id, key, label, icon, route, order_index, nesting_level, visible, required_permission, category)
SELECT
  'bf0d4e1c-a2d5-4027-861c-d724dd021e52', 'admin', 'Admin Console', '🔐', NULL, 40, 0, true, 'manage:users', 'admin'
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO menus (organization_id, parent_id, key, label, icon, route, order_index, nesting_level, visible, required_permission, category)
SELECT
  'bf0d4e1c-a2d5-4027-861c-d724dd021e52',
  (SELECT id FROM menus WHERE organization_id = 'bf0d4e1c-a2d5-4027-861c-d724dd021e52' AND key = 'admin'),
  'admin.users', 'Manage Users', '👤', '/admin/users', 10, 1, true, 'manage:users', 'admin'
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO menus (organization_id, parent_id, key, label, icon, route, order_index, nesting_level, visible, required_permission, category)
SELECT
  'bf0d4e1c-a2d5-4027-861c-d724dd021e52',
  (SELECT id FROM menus WHERE organization_id = 'bf0d4e1c-a2d5-4027-861c-d724dd021e52' AND key = 'admin'),
  'admin.roles', 'Manage Roles', '🛡️', '/admin/roles', 20, 1, true, 'manage:users', 'admin'
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO menus (organization_id, parent_id, key, label, icon, route, order_index, nesting_level, visible, required_permission, category)
SELECT
  'bf0d4e1c-a2d5-4027-861c-d724dd021e52',
  (SELECT id FROM menus WHERE organization_id = 'bf0d4e1c-a2d5-4027-861c-d724dd021e52' AND key = 'admin'),
  'admin.resources', 'Resources', '📦', '/admin/resources', 30, 1, true, 'manage:users', 'admin'
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO menus (organization_id, parent_id, key, label, icon, route, order_index, nesting_level, visible, required_permission, category)
SELECT
  'bf0d4e1c-a2d5-4027-861c-d724dd021e52',
  (SELECT id FROM menus WHERE organization_id = 'bf0d4e1c-a2d5-4027-861c-d724dd021e52' AND key = 'admin'),
  'admin.branches', 'Branches', '🌍', '/admin/branches', 40, 1, true, 'manage:users', 'admin'
ON CONFLICT (organization_id, key) DO NOTHING;
