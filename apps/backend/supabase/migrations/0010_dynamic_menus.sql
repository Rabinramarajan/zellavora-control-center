-- Dynamic Menu System for Enterprise Admin Platform
-- Supports unlimited nesting, permissions, feature flags, and usage tracking

DROP TABLE IF EXISTS menus CASCADE;

-- ========================================
-- Menu Items Core Table
-- ========================================

CREATE TABLE IF NOT EXISTS menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES menus(id) ON DELETE CASCADE,

  -- Core properties
  key VARCHAR(255) NOT NULL,                    -- unique identifier (e.g., "dashboard", "projects.list")
  label VARCHAR(255) NOT NULL,                   -- display name
  title VARCHAR(255),                            -- tooltip/expanded name
  description TEXT,                              -- admin-facing description
  icon VARCHAR(255),                             -- icon class (Material, Font Awesome, or SVG path)
  badge_icon VARCHAR(100),                       -- badge type (unread, alert, etc)
  route VARCHAR(500),                            -- Angular route path (null for sections)
  external_url VARCHAR(500),                     -- external link (null if internal route)

  -- Ordering & hierarchy
  order_index INT NOT NULL DEFAULT 0,
  nesting_level INT NOT NULL DEFAULT 0,         -- computed, for performance
  breadcrumb_path TEXT,                          -- json array of parent ids, for traversal

  -- Visibility & conditions
  visible BOOLEAN NOT NULL DEFAULT true,
  visibility_type VARCHAR(50) DEFAULT 'all',     -- all, authenticated, role, custom
  visibility_condition JSONB,                    -- complex rules: {"roles": [...], "tenants": [...]}

  -- Feature & permission gating
  feature_flag VARCHAR(255),                     -- optional feature flag name
  required_permission VARCHAR(255),              -- single permission code
  required_permissions TEXT[] DEFAULT '{}',      -- multiple permission codes (ANY match)
  requires_all_permissions BOOLEAN DEFAULT false,-- ALL must match

  -- Category & metadata
  category VARCHAR(100),                         -- main, admin, user-management, etc
  badge_counter_key VARCHAR(255),                -- metric key for dynamic counter (e.g., "unread_projects")
  badge_counter_value INT DEFAULT 0,             -- cached counter (updated via service)
  badge_style VARCHAR(50) DEFAULT 'default',     -- success, danger, warning, info
  metadata JSONB DEFAULT '{}'::jsonb,            -- extensible data

  -- Tracking
  view_count BIGINT DEFAULT 0,
  is_favorite BOOLEAN DEFAULT false,
  is_recent BOOLEAN DEFAULT false,

  -- Audit
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, key),
  CHECK (nesting_level >= 0),
  CHECK (external_url IS NULL OR route IS NULL)  -- can't have both
);

-- Indexes for optimal query performance
CREATE INDEX idx_menus_org ON menus(organization_id);
CREATE INDEX idx_menus_parent ON menus(parent_id);
CREATE INDEX idx_menus_org_parent ON menus(organization_id, parent_id);
CREATE INDEX idx_menus_key ON menus(key);
CREATE INDEX idx_menus_visible ON menus(organization_id, visible);
CREATE INDEX idx_menus_feature_flag ON menus(feature_flag);
CREATE INDEX idx_menus_category ON menus(category);
CREATE INDEX idx_menus_nesting_level ON menus(nesting_level);
CREATE INDEX idx_menus_organization_visible_nesting ON menus(organization_id, visible, nesting_level);

-- ========================================
-- Menu Usage Tracking
-- ========================================

CREATE TABLE IF NOT EXISTS menu_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,

  is_favorite BOOLEAN DEFAULT false,
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  access_count INT NOT NULL DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, user_id, menu_id)
);

CREATE INDEX idx_menu_usage_user_org ON menu_usage(user_id, organization_id);
CREATE INDEX idx_menu_usage_favorites ON menu_usage(user_id, is_favorite);
CREATE INDEX idx_menu_usage_recent ON menu_usage(user_id, last_accessed_at DESC);
CREATE INDEX idx_menu_usage_org ON menu_usage(organization_id);

-- ========================================
-- Menu Categories
-- ========================================

CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  key VARCHAR(100) NOT NULL,                     -- main, admin, user-management
  label VARCHAR(200) NOT NULL,
  icon VARCHAR(255),
  color VARCHAR(20),
  order_index INT NOT NULL DEFAULT 0,
  description TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, key)
);

CREATE INDEX idx_menu_categories_org ON menu_categories(organization_id);
CREATE INDEX idx_menu_categories_key ON menu_categories(organization_id, key);

-- ========================================
-- Menu Version History (Audit Trail)
-- ========================================

CREATE TABLE IF NOT EXISTS menu_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,

  version_number INT NOT NULL,
  snapshot JSONB NOT NULL,                       -- full menu state at this version
  change_type VARCHAR(50),                       -- created, updated, deleted
  change_summary TEXT,
  changed_fields TEXT[],                         -- array of field names changed

  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(menu_id, version_number)
);

CREATE INDEX idx_menu_versions_org ON menu_versions(organization_id);
CREATE INDEX idx_menu_versions_menu ON menu_versions(menu_id);
CREATE INDEX idx_menu_versions_changed_at ON menu_versions(changed_at DESC);

-- ========================================
-- Cache State Management
-- ========================================

CREATE TABLE IF NOT EXISTS menu_cache_state (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

  last_invalidated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invalidation_reason VARCHAR(255),
  total_menu_count INT DEFAULT 0,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_cache_state_invalidated ON menu_cache_state(last_invalidated_at DESC);

-- ========================================
-- Triggers for Audit & Updates
-- ========================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_menu_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_menus_updated ON menus;
CREATE TRIGGER trg_menus_updated
  BEFORE UPDATE ON menus
  FOR EACH ROW
  EXECUTE FUNCTION update_menu_timestamp();

DROP TRIGGER IF EXISTS trg_menu_usage_updated ON menu_usage;
CREATE TRIGGER trg_menu_usage_updated
  BEFORE UPDATE ON menu_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_menu_timestamp();

DROP TRIGGER IF EXISTS trg_menu_categories_updated ON menu_categories;
CREATE TRIGGER trg_menu_categories_updated
  BEFORE UPDATE ON menu_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_menu_timestamp();

DROP TRIGGER IF EXISTS trg_menu_cache_state_updated ON menu_cache_state;
CREATE TRIGGER trg_menu_cache_state_updated
  BEFORE UPDATE ON menu_cache_state
  FOR EACH ROW
  EXECUTE FUNCTION update_menu_timestamp();

-- Trigger to invalidate cache when menu changes
CREATE OR REPLACE FUNCTION invalidate_menu_cache()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE menu_cache_state
  SET last_invalidated_at = now(),
      invalidation_reason = COALESCE(NEW.label, 'Menu update'),
      updated_at = now()
  WHERE organization_id = NEW.organization_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_menus_invalidate_cache ON menus;
CREATE TRIGGER trg_menus_invalidate_cache
  AFTER INSERT OR UPDATE OR DELETE ON menus
  FOR EACH ROW
  EXECUTE FUNCTION invalidate_menu_cache();

-- ========================================
-- Row Level Security (RLS)
-- ========================================

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_cache_state ENABLE ROW LEVEL SECURITY;

-- Org members can view visible menus
DROP POLICY IF EXISTS "Org members can view visible menus" ON menus;
CREATE POLICY "Org members can view visible menus"
  ON menus
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
    AND visible = true
  );

-- Admins can manage all menus
DROP POLICY IF EXISTS "Admins can manage menus" ON menus;
CREATE POLICY "Admins can manage menus"
  ON menus
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Users can view their own usage
DROP POLICY IF EXISTS "Users can view own menu usage" ON menu_usage;
CREATE POLICY "Users can view own menu usage"
  ON menu_usage
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own usage
DROP POLICY IF EXISTS "Users can update own menu usage" ON menu_usage;
CREATE POLICY "Users can update own menu usage"
  ON menu_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own menu usage update" ON menu_usage;
CREATE POLICY "Users can update own menu usage update"
  ON menu_usage
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Org members can view menu categories
DROP POLICY IF EXISTS "Org members can view menu categories" ON menu_categories;
CREATE POLICY "Org members can view menu categories"
  ON menu_categories
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Admins can manage menu categories
DROP POLICY IF EXISTS "Admins can manage menu categories" ON menu_categories;
CREATE POLICY "Admins can manage menu categories"
  ON menu_categories
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Org members can view menu versions
DROP POLICY IF EXISTS "Org members can view menu versions" ON menu_versions;
CREATE POLICY "Org members can view menu versions"
  ON menu_versions
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ========================================
-- Initial Data Seed
-- ========================================

-- Note: This is a template. Actual seeding should be done per-organization
-- via the admin UI or application logic to ensure proper multi-tenancy

-- Create default categories for new organizations
INSERT INTO menu_categories (organization_id, key, label, icon, color, order_index, description)
SELECT
  organizations.id,
  'main',
  'Main Navigation',
  'dashboard',
  '#2563eb',
  0,
  'Primary navigation menu items'
FROM organizations
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO menu_categories (organization_id, key, label, icon, color, order_index, description)
SELECT
  organizations.id,
  'admin',
  'Administration',
  'settings',
  '#6366f1',
  1,
  'Admin and system management'
FROM organizations
ON CONFLICT (organization_id, key) DO NOTHING;

-- Initialize cache state for all organizations
INSERT INTO menu_cache_state (organization_id, last_invalidated_at, total_menu_count)
SELECT id, now(), 0
FROM organizations
ON CONFLICT (organization_id) DO NOTHING;
