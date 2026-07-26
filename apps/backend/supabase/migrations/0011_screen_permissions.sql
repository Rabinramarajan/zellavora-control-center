-- Screen-Level Permission System
-- Provides fine-grained authorization at screen and action level

-- ========================================
-- Permissions Table
-- ========================================

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Permission identity
  key VARCHAR(255) NOT NULL,                    -- e.g., "dashboard:view", "projects:create"
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Categorization
  resource VARCHAR(100) NOT NULL,               -- e.g., "dashboard", "projects", "blogs"
  action VARCHAR(100) NOT NULL,                 -- e.g., "view", "create", "edit", "delete"
  category VARCHAR(100),                        -- e.g., "core", "admin", "reporting"

  -- Configuration
  requires_approval BOOLEAN DEFAULT false,      -- Requires admin approval
  requires_mfa BOOLEAN DEFAULT false,           -- Requires multi-factor auth
  requires_audit BOOLEAN DEFAULT true,          -- Must log this action
  risk_level VARCHAR(50) DEFAULT 'low',         -- low, medium, high, critical
  audit_level VARCHAR(50) DEFAULT 'standard',   -- standard, detailed, none

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  enabled BOOLEAN DEFAULT true,

  -- Tracking
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, key),
  CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  CHECK (audit_level IN ('standard', 'detailed', 'none'))
);

CREATE INDEX idx_permissions_org ON permissions(organization_id);
CREATE INDEX idx_permissions_resource ON permissions(organization_id, resource);
CREATE INDEX idx_permissions_action ON permissions(organization_id, action);
CREATE INDEX idx_permissions_key ON permissions(organization_id, key);
CREATE INDEX idx_permissions_risk ON permissions(risk_level);

-- ========================================
-- Screens Table (Features/Pages)
-- ========================================

CREATE TABLE IF NOT EXISTS screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Screen identity
  key VARCHAR(255) NOT NULL,                    -- e.g., "dashboard", "projects.list", "users.edit"
  name VARCHAR(255) NOT NULL,
  description TEXT,
  route VARCHAR(500),                           -- Angular route path
  icon VARCHAR(255),

  -- Hierarchy
  parent_id UUID REFERENCES screens(id) ON DELETE CASCADE,
  order_index INT DEFAULT 0,

  -- Configuration
  requires_authentication BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  feature_flag VARCHAR(255),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  enabled BOOLEAN DEFAULT true,

  -- Tracking
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, key)
);

CREATE INDEX idx_screens_org ON screens(organization_id);
CREATE INDEX idx_screens_key ON screens(organization_id, key);
CREATE INDEX idx_screens_parent ON screens(parent_id);
CREATE INDEX idx_screens_route ON screens(route);

-- ========================================
-- Screen-Permission Mapping
-- ========================================

CREATE TABLE IF NOT EXISTS screen_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

  -- Configuration
  required BOOLEAN DEFAULT false,               -- Permission required to view screen
  conditional_access JSONB,                     -- Complex access rules
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(screen_id, permission_id)
);

CREATE INDEX idx_screen_permissions_screen ON screen_permissions(screen_id);
CREATE INDEX idx_screen_permissions_permission ON screen_permissions(permission_id);
CREATE INDEX idx_screen_permissions_org ON screen_permissions(organization_id);

-- ========================================
-- Role-Permission Mapping
-- ========================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

  -- Configuration
  granted BOOLEAN DEFAULT true,                 -- true = grant, false = deny
  priority INT DEFAULT 0,                       -- Higher priority wins on conflict
  conditions JSONB,                             -- Complex conditions (time-based, data-based)
  expiration_date TIMESTAMPTZ,                  -- Permission expires after this date

  -- Tracking
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX idx_role_permissions_org ON role_permissions(organization_id);
CREATE INDEX idx_role_permissions_granted ON role_permissions(granted);
CREATE INDEX idx_role_permissions_expiration ON role_permissions(expiration_date);

-- ========================================
-- User-Permission Mapping (Direct Grants)
-- ========================================

CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

  -- Configuration
  granted BOOLEAN DEFAULT true,                 -- true = grant, false = deny (override)
  conditions JSONB,                             -- Complex conditions
  expiration_date TIMESTAMPTZ,                  -- Permission expires

  -- Context
  reason TEXT,                                  -- Why was this permission granted/denied
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Tracking
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, permission_id)
);

CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission ON user_permissions(permission_id);
CREATE INDEX idx_user_permissions_org ON user_permissions(organization_id);
CREATE INDEX idx_user_permissions_granted ON user_permissions(granted);
CREATE INDEX idx_user_permissions_expiration ON user_permissions(expiration_date);

-- ========================================
-- Permission Audit Log
-- ========================================

CREATE TABLE IF NOT EXISTS permission_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE SET NULL,
  screen_id UUID REFERENCES screens(id) ON DELETE SET NULL,

  -- Action details
  action VARCHAR(100) NOT NULL,                 -- view, create, edit, delete, approve, etc.
  resource_type VARCHAR(100),                   -- What resource was accessed
  resource_id VARCHAR(500),                     -- ID of the resource
  status VARCHAR(50),                           -- allowed, denied, pending_approval
  deny_reason VARCHAR(255),                     -- Why was it denied

  -- Context
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(500),
  device_info JSONB,

  -- Data
  change_data JSONB,                            -- What data was changed
  result_data JSONB,                            -- Result of the action
  error_details JSONB,

  -- Temporal
  request_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_time_ms INT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_permission_audit_user ON permission_audit_logs(user_id);
CREATE INDEX idx_permission_audit_permission ON permission_audit_logs(permission_id);
CREATE INDEX idx_permission_audit_screen ON permission_audit_logs(screen_id);
CREATE INDEX idx_permission_audit_org ON permission_audit_logs(organization_id);
CREATE INDEX idx_permission_audit_action ON permission_audit_logs(action);
CREATE INDEX idx_permission_audit_status ON permission_audit_logs(status);
CREATE INDEX idx_permission_audit_timestamp ON permission_audit_logs(request_timestamp DESC);

-- ========================================
-- Permission Cache Table
-- ========================================

CREATE TABLE IF NOT EXISTS permission_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Cached permissions set
  permissions TEXT[] DEFAULT '{}',              -- Array of permission keys
  screens TEXT[] DEFAULT '{}',                  -- Array of accessible screen keys
  denied_permissions TEXT[] DEFAULT '{}',       -- Explicitly denied permissions
  cache_hash VARCHAR(64),                       -- Hash of permissions for invalidation

  -- Metadata
  expires_at TIMESTAMPTZ,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_permission_cache_user ON permission_cache(user_id);
CREATE INDEX idx_permission_cache_expires ON permission_cache(expires_at);

-- ========================================
-- Permission Request (For Approval Workflow)
-- ========================================

CREATE TABLE IF NOT EXISTS permission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

  -- Request details
  status VARCHAR(50) DEFAULT 'pending',         -- pending, approved, rejected, expired
  reason TEXT NOT NULL,                         -- Why does user need this permission
  requested_until TIMESTAMPTZ,                  -- Until when is permission needed
  business_justification TEXT,

  -- Review
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  approval_action VARCHAR(50),                  -- approved, rejected, approved_with_conditions

  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_permission_requests_user ON permission_requests(user_id);
CREATE INDEX idx_permission_requests_permission ON permission_requests(permission_id);
CREATE INDEX idx_permission_requests_org ON permission_requests(organization_id);
CREATE INDEX idx_permission_requests_status ON permission_requests(status);
CREATE INDEX idx_permission_requests_reviewed ON permission_requests(reviewed_at);

-- ========================================
-- Triggers
-- ========================================

DROP TRIGGER IF EXISTS trg_permissions_updated ON permissions;
CREATE TRIGGER trg_permissions_updated
  BEFORE UPDATE ON permissions
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_screens_updated ON screens;
CREATE TRIGGER trg_screens_updated
  BEFORE UPDATE ON screens
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_role_permissions_updated ON role_permissions;
CREATE TRIGGER trg_role_permissions_updated
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_user_permissions_updated ON user_permissions;
CREATE TRIGGER trg_user_permissions_updated
  BEFORE UPDATE ON user_permissions
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_permission_cache_invalidate ON role_permissions;
CREATE TRIGGER trg_permission_cache_invalidate
  AFTER INSERT OR UPDATE OR DELETE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION invalidate_permission_cache();

DROP TRIGGER IF EXISTS trg_permission_cache_invalidate_user ON user_permissions;
CREATE TRIGGER trg_permission_cache_invalidate_user
  AFTER INSERT OR UPDATE OR DELETE ON user_permissions
  FOR EACH ROW EXECUTE FUNCTION invalidate_permission_cache();

-- ========================================
-- RLS Policies
-- ========================================

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE screen_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_requests ENABLE ROW LEVEL SECURITY;

-- Org members can view permissions
DROP POLICY IF EXISTS "Org members can view permissions" ON permissions;
CREATE POLICY "Org members can view permissions"
  ON permissions
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Admins can manage permissions
DROP POLICY IF EXISTS "Admins can manage permissions" ON permissions;
CREATE POLICY "Admins can manage permissions"
  ON permissions
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Similar policies for screens, role_permissions, user_permissions, etc.
-- Users can view their own permissions
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
CREATE POLICY "Users can view own permissions"
  ON user_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ========================================
-- Seed Default Permissions
-- ========================================

-- Standard CRUD permissions
INSERT INTO permissions (organization_id, key, name, description, resource, action, risk_level)
SELECT
  organizations.id,
  'screens:view',
  'View Screens',
  'View screens and features',
  'screens',
  'view',
  'low'
FROM organizations
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO permissions (organization_id, key, name, description, resource, action, risk_level)
SELECT
  organizations.id,
  'screens:create',
  'Create Screens',
  'Create new screens',
  'screens',
  'create',
  'medium'
FROM organizations
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO permissions (organization_id, key, name, description, resource, action, risk_level)
SELECT
  organizations.id,
  'screens:edit',
  'Edit Screens',
  'Edit existing screens',
  'screens',
  'edit',
  'medium'
FROM organizations
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO permissions (organization_id, key, name, description, resource, action, risk_level)
SELECT
  organizations.id,
  'screens:delete',
  'Delete Screens',
  'Delete screens',
  'screens',
  'delete',
  'high'
FROM organizations
ON CONFLICT (organization_id, key) DO NOTHING;

-- Standard resource permissions
INSERT INTO permissions (organization_id, key, name, description, resource, action, risk_level)
SELECT
  organizations.id,
  resource_action.resource || ':' || resource_action.action,
  INITCAP(resource_action.resource) || ' ' || INITCAP(resource_action.action),
  INITCAP(resource_action.action) || ' ' || resource_action.resource,
  resource_action.resource,
  resource_action.action,
  CASE
    WHEN resource_action.action IN ('view', 'export') THEN 'low'::VARCHAR
    WHEN resource_action.action IN ('create', 'edit', 'import', 'clone') THEN 'medium'::VARCHAR
    WHEN resource_action.action IN ('delete', 'reject', 'archive') THEN 'high'::VARCHAR
    ELSE 'medium'::VARCHAR
  END
FROM organizations,
LATERAL (
  SELECT * FROM (VALUES
    ('dashboard', 'view'),
    ('projects', 'view'), ('projects', 'create'), ('projects', 'edit'), ('projects', 'delete'),
    ('blogs', 'view'), ('blogs', 'create'), ('blogs', 'edit'), ('blogs', 'delete'), ('blogs', 'publish'),
    ('settings', 'view'), ('settings', 'edit'), ('settings', 'delete'),
    ('users', 'view'), ('users', 'create'), ('users', 'edit'), ('users', 'delete'), ('users', 'approve'),
    ('reports', 'view'), ('reports', 'create'), ('reports', 'export'), ('reports', 'delete'),
    ('media', 'view'), ('media', 'upload'), ('media', 'delete'), ('media', 'organize'),
    ('analytics', 'view'), ('analytics', 'export'), ('analytics', 'configure'),
    ('permissions', 'view'), ('permissions', 'manage'), ('permissions', 'audit')
  ) AS t(resource, action)
) resource_action
ON CONFLICT (organization_id, key) DO NOTHING;

-- Initialize empty permission cache for all users
INSERT INTO permission_cache (organization_id, user_id, permissions, expires_at)
SELECT organization_id, id, '{}'::TEXT[], now() + INTERVAL '30 minutes'
FROM users
ON CONFLICT (organization_id, user_id) DO NOTHING;
