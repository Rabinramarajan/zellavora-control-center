-- Enterprise Feature Flag System
-- Supports multi-tenancy, role-based, user-based, and context-aware feature flags

-- ========================================
-- Feature Flags (Core)
-- ========================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Feature identity
  key VARCHAR(255) NOT NULL,                    -- e.g., "new-dashboard", "beta-reporting"
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Status
  enabled BOOLEAN DEFAULT false,                -- Global enable/disable (kill switch)
  status VARCHAR(50) DEFAULT 'development',    -- development, staging, production, archived

  -- Scheduling
  scheduled_at TIMESTAMPTZ,                     -- When to automatically enable
  expires_at TIMESTAMPTZ,                       -- When to automatically disable
  rollout_start_date TIMESTAMPTZ,
  rollout_end_date TIMESTAMPTZ,

  -- Targeting
  percentage_rollout NUMERIC(5, 2) DEFAULT 0,  -- 0-100% of users
  rollout_strategy VARCHAR(50),                 -- percent, gradual, canary
  targeting_enabled BOOLEAN DEFAULT true,

  -- Dependencies
  depends_on TEXT[],                            -- Array of feature flag keys
  blocks TEXT[],                                -- Features this blocks

  -- Metadata
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}',
  category VARCHAR(100),

  -- Audit
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, key),
  CHECK (percentage_rollout >= 0 AND percentage_rollout <= 100)
);

CREATE INDEX idx_feature_flags_org ON feature_flags(organization_id);
CREATE INDEX idx_feature_flags_key ON feature_flags(organization_id, key);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(organization_id, enabled);
CREATE INDEX idx_feature_flags_status ON feature_flags(status);
CREATE INDEX idx_feature_flags_scheduled ON feature_flags(scheduled_at);
CREATE INDEX idx_feature_flags_expires ON feature_flags(expires_at);

-- ========================================
-- Feature Flag Toggles (Targeting Rules)
-- ========================================

CREATE TABLE IF NOT EXISTS feature_flag_toggles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,

  -- Targeting
  toggle_type VARCHAR(50) NOT NULL,             -- user, role, tenant, environment, country, subscription, client_version
  target_value VARCHAR(500) NOT NULL,           -- The specific value to match
  enabled BOOLEAN DEFAULT true,

  -- Rule
  condition VARCHAR(50) DEFAULT 'equals',      -- equals, contains, starts_with, regex
  percentage NUMERIC(5, 2) DEFAULT 100,        -- Percentage of matching users

  -- Metadata
  priority INT DEFAULT 0,                       -- Higher priority evaluated first
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(feature_flag_id, toggle_type, target_value)
);

CREATE INDEX idx_feature_flag_toggles_flag ON feature_flag_toggles(feature_flag_id);
CREATE INDEX idx_feature_flag_toggles_type ON feature_flag_toggles(toggle_type);
CREATE INDEX idx_feature_flag_toggles_priority ON feature_flag_toggles(priority DESC);

-- ========================================
-- Feature Flag Overrides (User/Tenant Specific)
-- ========================================

CREATE TABLE IF NOT EXISTS feature_flag_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,

  -- Target
  override_type VARCHAR(50) NOT NULL,           -- user, tenant, role
  target_id VARCHAR(500) NOT NULL,              -- User ID, tenant ID, or role name

  -- Override
  enabled BOOLEAN NOT NULL,                     -- Force enable or disable
  reason TEXT,

  -- Expiration
  expires_at TIMESTAMPTZ,

  -- Audit
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(feature_flag_id, override_type, target_id)
);

CREATE INDEX idx_feature_flag_overrides_flag ON feature_flag_overrides(feature_flag_id);
CREATE INDEX idx_feature_flag_overrides_target ON feature_flag_overrides(override_type, target_id);
CREATE INDEX idx_feature_flag_overrides_expires ON feature_flag_overrides(expires_at);

-- ========================================
-- Feature Flag Evaluations (Cache)
-- ========================================

CREATE TABLE IF NOT EXISTS feature_flag_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Cached evaluations
  enabled_features TEXT[] DEFAULT '{}',        -- Array of feature keys enabled for user
  disabled_features TEXT[] DEFAULT '{}',       -- Array of feature keys disabled for user

  -- Context
  client_version VARCHAR(50),
  country VARCHAR(2),
  environment VARCHAR(50),
  user_agent TEXT,
  ip_address INET,

  -- Validity
  expires_at TIMESTAMPTZ,
  cache_hash VARCHAR(64),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_feature_flag_cache_user ON feature_flag_cache(user_id);
CREATE INDEX idx_feature_flag_cache_expires ON feature_flag_cache(expires_at);

-- ========================================
-- Feature Flag Audit Logs
-- ========================================

CREATE TABLE IF NOT EXISTS feature_flag_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,

  -- Action
  action VARCHAR(100) NOT NULL,                -- created, enabled, disabled, updated, rollout_changed, override_added
  details JSONB,
  old_value JSONB,
  new_value JSONB,

  -- User
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,

  -- Evaluation logs
  evaluation_count INT DEFAULT 0,              -- Number of times evaluated
  last_evaluated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feature_flag_audit_org ON feature_flag_audit_logs(organization_id);
CREATE INDEX idx_feature_flag_audit_flag ON feature_flag_audit_logs(feature_flag_id);
CREATE INDEX idx_feature_flag_audit_action ON feature_flag_audit_logs(action);
CREATE INDEX idx_feature_flag_audit_user ON feature_flag_audit_logs(user_id);
CREATE INDEX idx_feature_flag_audit_timestamp ON feature_flag_audit_logs(created_at DESC);

-- ========================================
-- Feature Flag Experiments (A/B Testing)
-- ========================================

CREATE TABLE IF NOT EXISTS feature_flag_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,

  -- Experiment
  name VARCHAR(255) NOT NULL,
  hypothesis TEXT,
  control_variant VARCHAR(100) DEFAULT 'control',
  treatment_variant VARCHAR(100) DEFAULT 'treatment',

  -- Status
  status VARCHAR(50) DEFAULT 'draft',          -- draft, running, completed, archived
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Metrics
  sample_size INT,
  confidence_level NUMERIC(3, 2),
  power NUMERIC(3, 2),

  -- Results
  results JSONB,
  winner VARCHAR(100),
  significance_level NUMERIC(5, 4),

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feature_flag_experiments_flag ON feature_flag_experiments(feature_flag_id);
CREATE INDEX idx_feature_flag_experiments_status ON feature_flag_experiments(status);

-- ========================================
-- Triggers
-- ========================================

DROP TRIGGER IF EXISTS trg_feature_flags_updated ON feature_flags;
CREATE TRIGGER trg_feature_flags_updated
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_feature_flag_toggles_updated ON feature_flag_toggles;
CREATE TRIGGER trg_feature_flag_toggles_updated
  BEFORE UPDATE ON feature_flag_toggles
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_feature_flag_overrides_updated ON feature_flag_overrides;
CREATE TRIGGER trg_feature_flag_overrides_updated
  BEFORE UPDATE ON feature_flag_overrides
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Invalidate cache on flag changes
DROP FUNCTION IF EXISTS invalidate_feature_flag_cache CASCADE;
CREATE OR REPLACE FUNCTION invalidate_feature_flag_cache()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM feature_flag_cache
  WHERE organization_id = NEW.organization_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_feature_flag_invalidate_cache ON feature_flags;
CREATE TRIGGER trg_feature_flag_invalidate_cache
  AFTER INSERT OR UPDATE OR DELETE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION invalidate_feature_flag_cache();

DROP TRIGGER IF EXISTS trg_feature_flag_toggles_invalidate ON feature_flag_toggles;
CREATE TRIGGER trg_feature_flag_toggles_invalidate
  AFTER INSERT OR UPDATE OR DELETE ON feature_flag_toggles
  FOR EACH ROW EXECUTE FUNCTION invalidate_feature_flag_cache();

-- ========================================
-- RLS Policies
-- ========================================

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_toggles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_experiments ENABLE ROW LEVEL SECURITY;

-- Users can view feature flags in their organization
DROP POLICY IF EXISTS "Org members can view feature flags" ON feature_flags;
CREATE POLICY "Org members can view feature flags"
  ON feature_flags
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Admins can manage feature flags
DROP POLICY IF EXISTS "Admins can manage feature flags" ON feature_flags;
CREATE POLICY "Admins can manage feature flags"
  ON feature_flags
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Users can view their own cache
DROP POLICY IF EXISTS "Users can view own feature cache" ON feature_flag_cache;
CREATE POLICY "Users can view own feature cache"
  ON feature_flag_cache
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ========================================
-- Initial Data
-- ========================================

-- Create default feature flags for new organizations
INSERT INTO feature_flags (organization_id, key, name, description, enabled, status)
SELECT
  organizations.id,
  'new_dashboard',
  'New Dashboard',
  'Next-generation dashboard UI',
  false,
  'development'
FROM organizations
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO feature_flags (organization_id, key, name, description, enabled, status)
SELECT
  organizations.id,
  'beta_features',
  'Beta Features',
  'Enable beta/experimental features',
  false,
  'staging'
FROM organizations
ON CONFLICT (organization_id, key) DO NOTHING;

INSERT INTO feature_flags (organization_id, key, name, description, enabled, status)
SELECT
  organizations.id,
  'dark_mode',
  'Dark Mode',
  'Dark theme support',
  true,
  'production'
FROM organizations
ON CONFLICT (organization_id, key) DO NOTHING;
