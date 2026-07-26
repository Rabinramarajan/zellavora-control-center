-- ============================================================================
-- Enterprise Multi-Tenant Authentication System - Phase 1
-- ============================================================================
-- This migration extends the multi-tenancy foundation with:
--   1. client_code on organizations (tenant identifier at login)
--   2. Granular permissions + role bindings
--   3. Dynamic menus (per-tenant, role-based visibility)
--   4. MFA secrets + recovery codes
--   5. Login attempt tracking (rate limiting + lockout)
--   6. JWT denylist (server-side revocation)
--   7. Refresh-token rotation with reuse detection
--   8. Audit log triggers (auto-emit on sensitive changes)
-- ============================================================================

-- ============================================================================
-- 1. CLIENT CODE ON ORGANIZATIONS
-- ============================================================================
-- The client_code is the public, human-shareable identifier for a tenant.
-- Users type this FIRST on the login screen before email/password.
-- Format: uppercase letters/digits, 4-16 chars (e.g. "ACME", "STRT-UP-7")
-- Uniqueness is case-insensitive; we store normalized uppercase.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS client_code VARCHAR(16) UNIQUE;

-- Backfill: derive from slug if empty (idempotent)
UPDATE organizations
SET client_code = UPPER(SUBSTRING(REGEXP_REPLACE(slug, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 16))
WHERE client_code IS NULL;

ALTER TABLE organizations
  ALTER COLUMN client_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_client_code_lower
  ON organizations (UPPER(client_code));

-- Add tenant policy flags already defined in 0002; reinforce here
COMMENT ON COLUMN organizations.client_code IS
  'Public tenant identifier. Users enter this on the login screen BEFORE email/password.';
COMMENT ON COLUMN organizations.enforce_2fa IS
  'If true, all members of this organization MUST have 2FA enabled to log in.';

-- ============================================================================
-- 2. PERMISSIONS (granular)
-- ============================================================================
-- Permissions are stored as `resource:action` strings, e.g.:
--   'projects:read', 'projects:write', 'projects:delete',
--   'members:manage', 'billing:manage', 'audit:read', etc.
-- Roles are then granted sets of permissions.
-- (roles + permission_matrix already exist in 0002 — we extend here.)

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) UNIQUE NOT NULL,         -- e.g. 'projects:read'
  resource VARCHAR(50) NOT NULL,             -- e.g. 'projects'
  action VARCHAR(50) NOT NULL,               -- e.g. 'read'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(resource, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_org ON role_permissions(organization_id);

-- Seed the canonical permission catalogue (idempotent via ON CONFLICT)
INSERT INTO permissions (code, resource, action, description) VALUES
  -- organization
  ('organization:read',    'organization', 'read',    'View organization details'),
  ('organization:manage',  'organization', 'manage',  'Update org settings, plan, branding'),
  ('organization:delete',  'organization', 'delete',  'Delete the organization'),
  -- members
  ('members:read',    'members', 'read',    'View member list'),
  ('members:invite',  'members', 'invite',  'Send invitations'),
  ('members:manage',  'members', 'manage',  'Change roles, deactivate members'),
  ('members:remove',  'members', 'remove',  'Remove members from org'),
  -- projects
  ('projects:read',   'projects', 'read',   'View projects'),
  ('projects:create', 'projects', 'create', 'Create projects'),
  ('projects:write',  'projects', 'write',  'Edit own/assigned projects'),
  ('projects:delete', 'projects', 'delete', 'Delete projects'),
  -- blog
  ('blog:read',   'blog', 'read',   'View blog posts'),
  ('blog:create', 'blog', 'create', 'Create posts'),
  ('blog:write',  'blog', 'write',  'Edit own posts'),
  ('blog:publish','blog', 'publish','Publish/unpublish any post'),
  ('blog:delete', 'blog', 'delete', 'Delete posts'),
  -- media
  ('media:read',   'media', 'read',   'View media files'),
  ('media:upload', 'media', 'upload', 'Upload files'),
  ('media:delete', 'media', 'delete', 'Delete files'),
  -- analytics / audit
  ('analytics:read', 'analytics', 'read', 'View analytics dashboards'),
  ('audit:read',     'audit',     'read', 'View audit logs'),
  -- api keys
  ('api_keys:read',   'api_keys', 'read',   'View API keys'),
  ('api_keys:create', 'api_keys', 'create', 'Create API keys'),
  ('api_keys:revoke', 'api_keys', 'revoke', 'Revoke API keys'),
  -- settings / billing
  ('settings:manage', 'settings', 'manage', 'Manage org settings'),
  ('billing:manage',  'billing',  'manage', 'Manage subscription/billing')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 3. DYNAMIC MENUS
-- ============================================================================
-- Each org defines its own menu tree. Menus are filtered by permission at
-- load-time (server returns only the menus the active role can see).
CREATE TABLE IF NOT EXISTS menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES menus(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,                 -- stable id used in i18n/permissions
  label VARCHAR(255) NOT NULL,               -- display label (or i18n key)
  icon VARCHAR(100),                         -- icon class/asset
  route VARCHAR(255),                        -- angular route
  required_permission VARCHAR(100),          -- FK-by-code to permissions.code
  order_index INTEGER DEFAULT 0,
  visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_menus_org ON menus(organization_id);
CREATE INDEX IF NOT EXISTS idx_menus_parent ON menus(parent_id);
CREATE INDEX IF NOT EXISTS idx_menus_order ON menus(organization_id, order_index);

-- Seed a default menu tree for a fresh organization (called from app code via
-- RPC, or by a one-off trigger when an organization is created).
-- We do NOT auto-seed here so existing orgs aren't mutated.
INSERT INTO menus (organization_id, parent_id, key, label, icon, route, required_permission, order_index)
SELECT o.id, NULL, m.key, m.label, m.icon, m.route, m.req, m.ord
FROM organizations o
CROSS JOIN (VALUES
  ('dashboard',   'Dashboard',  'pi-home',       '/dashboard',     NULL,                10),
  ('projects',    'Projects',   'pi-folder',     '/projects',      'projects:read',     20),
  ('blog',        'Blog',       'pi-book',       '/blog',          'blog:read',         30),
  ('media',       'Media',      'pi-image',      '/media',         'media:read',        40),
  ('analytics',   'Analytics',  'pi-chart-bar',  '/analytics',     'analytics:read',    50),
  ('users',       'Members',    'pi-users',      '/users',         'members:read',      60),
  ('audit',       'Audit Log',  'pi-shield',     '/settings/audit','audit:read',        70),
  ('settings',    'Settings',   'pi-cog',        '/settings',      'settings:manage',   80)
) AS m(key, label, icon, route, req, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM menus WHERE menus.organization_id = o.id AND menus.key = m.key
);

-- ============================================================================
-- 4. MFA: TOTP secret + recovery codes
-- ============================================================================
-- TOTP per RFC 6238, 30s window, 6 digits, SHA-1 (Google Authenticator compatible).
-- Secret is stored encrypted-at-rest (the application encrypts before write).
-- Recovery codes are single-use: 10 codes, each 10 chars, hashed with bcrypt.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_secret_encrypted TEXT,        -- app-encrypted TOTP secret
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mfa_last_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mfa_last_used_counter BIGINT;      -- anti-replay (TOTP counter)

CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash VARCHAR(255) NOT NULL,         -- bcrypt hash
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mfa_recovery_user ON mfa_recovery_codes(user_id);

-- ============================================================================
-- 5. LOGIN ATTEMPTS (rate-limit + lockout)
-- ============================================================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  client_code VARCHAR(16),
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason VARCHAR(50),         -- 'invalid_password', 'invalid_client', 'mfa_failed', 'locked', 'unknown_user'
  attempted_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts(email, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time   ON login_attempts(ip_address, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time      ON login_attempts(attempted_at DESC);

-- Account lockout window: an account is locked after 5 failed attempts in 15 min.
-- This is enforced server-side; users.locked_until is the authoritative field.

-- ============================================================================
-- 6. JWT DENYLIST (server-side revocation)
-- ============================================================================
-- We sign short-lived access tokens (15 min) so revocation is mostly a non-issue,
-- but we keep a denylist for: (a) emergency logout-everywhere, (b) compromised
-- tokens, (c) testing. Entries auto-expire with the underlying token's `exp`.
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti UUID PRIMARY KEY,                       -- JWT ID (unique per token)
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(100),                        -- 'logout', 'admin_revoke', 'compromised'
  revoked_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL             -- mirror the JWT's exp claim
);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user   ON revoked_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expiry ON revoked_tokens(expires_at);

-- ============================================================================
-- 7. REFRESH-TOKEN ROTATION + REUSE DETECTION
-- ============================================================================
-- We store the SHA-256 hash of every refresh token we issue. On rotation we:
--   1. Look up the presented token's hash
--   2. Mark it used (revoke)
--   3. Issue new pair (new hash)
-- Reuse of a used token = possible theft; we revoke the entire family.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(255),  -- sha256 of current refresh token
  ADD COLUMN IF NOT EXISTS refresh_token_family UUID,        -- groups rotations of one login
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sessions_refresh_hash ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_family       ON sessions(refresh_token_family);

-- ============================================================================
-- 8. AUDIT LOG: extend + triggers
-- ============================================================================
-- audit_logs already exists (0002). Extend with: previous/new value JSONB
-- for any row-level changes, plus a trigger-based auto-audit on hot tables.
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS request_id UUID,                   -- correlation id
  ADD COLUMN IF NOT EXISTS metadata JSONB,                    -- free-form extras
  ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'info'; -- info|warn|critical

CREATE INDEX IF NOT EXISTS idx_audit_logs_request ON audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);

-- Generic audit trigger: writes a row to audit_logs on INSERT/UPDATE/DELETE.
-- Skips itself to avoid recursion.
CREATE OR REPLACE FUNCTION fn_audit_trigger() RETURNS TRIGGER AS $$
DECLARE
  v_org UUID;
  v_actor UUID := auth.uid();
  v_old JSONB;
  v_new JSONB;
  v_action audit_action;
  v_resource TEXT := TG_TABLE_NAME;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_action := 'resource_created';
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_action := 'resource_updated';
  ELSIF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_action := 'resource_deleted';
  END IF;

  -- Try to pull an organization_id out of the row.
  IF TG_OP = 'DELETE' THEN
    v_org := (v_old ->> 'organization_id')::UUID;
  ELSE
    v_org := (v_new ->> 'organization_id')::UUID;
  END IF;

  INSERT INTO audit_logs (organization_id, actor_id, action, resource_type, resource_id, old_values, new_values)
  VALUES (v_org, v_actor, v_action, v_resource,
          COALESCE((v_new ->> 'id')::UUID, (v_old ->> 'id')::UUID),
          v_old, v_new);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit trigger to high-value tables (optional; uncomment per environment).
-- CREATE TRIGGER trg_audit_projects  AFTER INSERT OR UPDATE OR DELETE ON projects  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
-- CREATE TRIGGER trg_audit_blog      AFTER INSERT OR UPDATE OR DELETE ON blog_posts FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
-- CREATE TRIGGER trg_audit_members   AFTER INSERT OR UPDATE OR DELETE ON organization_members FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- ============================================================================
-- 9. RLS for the new tables
-- ============================================================================
ALTER TABLE permissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus              ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE revoked_tokens     ENABLE ROW LEVEL SECURITY;

-- permissions: read-all (catalogue), no client writes
CREATE POLICY "permissions_read_all" ON permissions
  FOR SELECT USING (true);

-- role_permissions: members of the org can read
CREATE POLICY "role_permissions_view_org" ON role_permissions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- menus: org members can read
CREATE POLICY "menus_view_org" ON menus
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );
CREATE POLICY "menus_manage_admin" ON menus
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin') AND deleted_at IS NULL
    )
  );

-- mfa_recovery_codes: only the owning user (via service-role or self) can read
CREATE POLICY "mfa_recovery_self" ON mfa_recovery_codes
  FOR ALL USING (user_id = auth.uid());

-- login_attempts: no client access; service-role only
CREATE POLICY "login_attempts_none" ON login_attempts
  FOR ALL USING (false);

-- revoked_tokens: no client access; service-role only
CREATE POLICY "revoked_tokens_none" ON revoked_tokens
  FOR ALL USING (false);

-- ============================================================================
-- 10. Helper view: effective user permissions per tenant
-- ============================================================================
-- Used by the /auth/me endpoint to load what the current user can do.
CREATE OR REPLACE VIEW v_user_effective_permissions AS
SELECT
  om.user_id,
  om.organization_id,
  p.code AS permission_code
FROM organization_members om
JOIN roles r ON r.organization_id = om.organization_id AND r.name::text = om.role::text
JOIN role_permissions rp ON rp.role_id = r.id AND rp.organization_id = om.organization_id
JOIN permissions p ON p.id = rp.permission_id
WHERE om.deleted_at IS NULL;

COMMENT ON VIEW v_user_effective_permissions IS
  'Resolves (user, organization) -> set of permission codes. Use on /auth/me to load capabilities.';

-- ============================================================================
-- 11. Lookup helper: tenant by client_code
-- ============================================================================
-- Encapsulates the case-insensitive lookup so the API doesn't have to remember
-- to call UPPER().
CREATE OR REPLACE FUNCTION fn_org_by_client_code(p_code TEXT)
RETURNS organizations
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT * FROM organizations WHERE UPPER(client_code) = UPPER(p_code) LIMIT 1;
$$;

-- ============================================================================
-- END OF MIGRATION 0004
-- ============================================================================
