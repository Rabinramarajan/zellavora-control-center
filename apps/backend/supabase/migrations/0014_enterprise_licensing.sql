-- Enterprise Licensing & Subscription System
-- Multi-tier licensing with usage tracking, billing integration, and feature entitlements

-- ========================================
-- License Plans (Tier Definitions)
-- ========================================

CREATE TABLE IF NOT EXISTS license_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  key VARCHAR(50) NOT NULL UNIQUE,              -- free, starter, professional, enterprise, custom
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Tier
  tier INT NOT NULL DEFAULT 0,                 -- 0=free, 1=starter, 2=professional, 3=enterprise, 4=custom
  status VARCHAR(50) DEFAULT 'active',         -- active, deprecated, archived

  -- Pricing
  price_monthly NUMERIC(12, 2),
  price_annual NUMERIC(12, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  setup_fee NUMERIC(12, 2) DEFAULT 0,

  -- Limits - Core
  max_users INT NOT NULL DEFAULT 1,
  max_storage_gb INT NOT NULL DEFAULT 1,       -- Gigabytes
  max_projects INT NOT NULL DEFAULT 1,
  max_api_calls_per_day INT NOT NULL DEFAULT 100,

  -- Limits - Advanced
  max_team_members INT DEFAULT 0,
  max_custom_fields INT DEFAULT 0,
  max_integrations INT DEFAULT 0,
  max_workflows INT DEFAULT 0,

  -- Features
  features JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Array of enabled features
  modules TEXT[] DEFAULT '{}',                  -- e.g., ['dashboard', 'reports', 'analytics']

  -- Support & SLA
  support_tier VARCHAR(50),                    -- community, email, priority, 24x7
  response_time_hours INT,                     -- SLA response time
  uptime_sla NUMERIC(5, 2),                    -- e.g., 99.9

  -- Metadata
  display_order INT DEFAULT 0,
  popular BOOLEAN DEFAULT false,
  recommended BOOLEAN DEFAULT false,
  hide_from_ui BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_license_plans_key ON license_plans(key);
CREATE INDEX idx_license_plans_tier ON license_plans(tier);
CREATE INDEX idx_license_plans_status ON license_plans(status);

-- ========================================
-- Organization Licenses (Active Subscriptions)
-- ========================================

CREATE TABLE IF NOT EXISTS organization_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  license_plan_id UUID NOT NULL REFERENCES license_plans(id),

  -- Subscription Details
  subscription_id VARCHAR(255),                -- Stripe subscription ID
  subscription_key VARCHAR(255),               -- Unique subscription identifier

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'active',  -- active, trial, suspended, cancelled, expired

  -- Dates
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  trial_expires_at TIMESTAMPTZ,
  renewal_date TIMESTAMPTZ,

  -- Billing
  billing_cycle VARCHAR(50) DEFAULT 'monthly',   -- monthly, quarterly, annual
  auto_renew BOOLEAN DEFAULT true,
  cancel_at_period_end BOOLEAN DEFAULT false,

  -- Payment
  payment_method_id VARCHAR(255),
  billing_email VARCHAR(255),

  -- Overrides (Custom for this org)
  custom_users_override INT,
  custom_storage_override INT,
  custom_projects_override INT,
  custom_api_calls_override INT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  notes TEXT,

  -- Audit
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id),
  UNIQUE(subscription_key)
);

CREATE INDEX idx_org_licenses_org ON organization_licenses(organization_id);
CREATE INDEX idx_org_licenses_plan ON organization_licenses(license_plan_id);
CREATE INDEX idx_org_licenses_status ON organization_licenses(status);
CREATE INDEX idx_org_licenses_expires ON organization_licenses(expires_at);
CREATE INDEX idx_org_licenses_renewal ON organization_licenses(renewal_date);
CREATE INDEX idx_org_licenses_subscription ON organization_licenses(subscription_id);

-- ========================================
-- License Usage Tracking
-- ========================================

CREATE TABLE IF NOT EXISTS license_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Tracking Period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Usage Metrics
  active_users INT DEFAULT 0,
  storage_used_gb NUMERIC(10, 2) DEFAULT 0,
  projects_created INT DEFAULT 0,
  api_calls_used INT DEFAULT 0,

  -- Advanced Metrics
  team_members_added INT DEFAULT 0,
  custom_fields_used INT DEFAULT 0,
  integrations_used INT DEFAULT 0,
  workflows_created INT DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'active',         -- active, over_limit, warned
  warning_sent BOOLEAN DEFAULT false,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, period_start, period_end)
);

CREATE INDEX idx_license_usage_org ON license_usage(organization_id);
CREATE INDEX idx_license_usage_period ON license_usage(period_start, period_end);
CREATE INDEX idx_license_usage_status ON license_usage(status);

-- ========================================
-- Feature Entitlements
-- ========================================

CREATE TABLE IF NOT EXISTS feature_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  license_plan_id UUID REFERENCES license_plans(id),

  -- Feature
  feature_key VARCHAR(255) NOT NULL,           -- e.g., 'advanced-reporting', 'ai-assistant'
  feature_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),                       -- reports, ai, integrations, workflows, etc.

  -- Entitlement
  enabled BOOLEAN DEFAULT true,
  tier INT DEFAULT 0,                          -- 0=basic, 1=advanced, 2=premium

  -- Limits
  usage_limit INT,                             -- Max uses per month, null = unlimited

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, feature_key)
);

CREATE INDEX idx_feature_entitlements_org ON feature_entitlements(organization_id);
CREATE INDEX idx_feature_entitlements_feature ON feature_entitlements(feature_key);
CREATE INDEX idx_feature_entitlements_category ON feature_entitlements(category);

-- ========================================
-- Module Access Control
-- ========================================

CREATE TABLE IF NOT EXISTS module_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Module
  module_key VARCHAR(255) NOT NULL,            -- dashboard, reports, analytics, admin, etc.
  module_name VARCHAR(255) NOT NULL,

  -- Access
  enabled BOOLEAN DEFAULT true,
  access_level VARCHAR(50) DEFAULT 'view',    -- view, edit, admin, manage

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, module_key)
);

CREATE INDEX idx_module_access_org ON module_access(organization_id);
CREATE INDEX idx_module_access_module ON module_access(module_key);

-- ========================================
-- Usage Events (Granular Tracking)
-- ========================================

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Event
  event_type VARCHAR(100) NOT NULL,            -- file_uploaded, report_generated, api_call, user_added, etc.
  quantity INT DEFAULT 1,

  -- Metadata
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_events_org ON usage_events(organization_id);
CREATE INDEX idx_usage_events_type ON usage_events(event_type);
CREATE INDEX idx_usage_events_user ON usage_events(user_id);
CREATE INDEX idx_usage_events_timestamp ON usage_events(created_at DESC);

-- ========================================
-- Billing & Invoices
-- ========================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  license_id UUID NOT NULL REFERENCES organization_licenses(id) ON DELETE CASCADE,

  -- Invoice Details
  invoice_number VARCHAR(50) NOT NULL,
  stripe_invoice_id VARCHAR(255),

  -- Amounts
  amount_due NUMERIC(12, 2) NOT NULL,
  amount_paid NUMERIC(12, 2) DEFAULT 0,
  amount_remaining NUMERIC(12, 2),
  currency VARCHAR(3) DEFAULT 'USD',

  -- Dates
  invoice_date TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ,
  paid_date TIMESTAMPTZ,

  -- Status
  status VARCHAR(50) DEFAULT 'draft',         -- draft, sent, viewed, paid, failed, voided

  -- Line Items
  line_items JSONB DEFAULT '[]'::jsonb,       -- Array of {description, quantity, unit_price, amount}

  -- Metadata
  pdf_url TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(invoice_number)
);

CREATE INDEX idx_invoices_org ON invoices(organization_id);
CREATE INDEX idx_invoices_license ON invoices(license_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date DESC);

-- ========================================
-- Renewal History
-- ========================================

CREATE TABLE IF NOT EXISTS renewal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  license_id UUID NOT NULL REFERENCES organization_licenses(id) ON DELETE CASCADE,

  -- Renewal Details
  renewal_date TIMESTAMPTZ NOT NULL,
  from_plan_id UUID REFERENCES license_plans(id),
  to_plan_id UUID REFERENCES license_plans(id),

  -- Type
  renewal_type VARCHAR(50),                   -- renewal, upgrade, downgrade, change_billing

  -- Details
  old_amount NUMERIC(12, 2),
  new_amount NUMERIC(12, 2),
  proration_credit NUMERIC(12, 2),

  -- Status
  status VARCHAR(50) DEFAULT 'completed',    -- pending, completed, failed, cancelled
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_renewal_history_org ON renewal_history(organization_id);
CREATE INDEX idx_renewal_history_license ON renewal_history(license_id);
CREATE INDEX idx_renewal_history_date ON renewal_history(renewal_date DESC);

-- ========================================
-- License Notifications
-- ========================================

CREATE TABLE IF NOT EXISTS license_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Notification
  notification_type VARCHAR(50) NOT NULL,    -- trial_ending, renewal_upcoming, usage_warning, expired, failed_payment

  -- Status
  status VARCHAR(50) DEFAULT 'pending',      -- pending, sent, clicked, dismissed
  sent_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  -- Content
  title VARCHAR(255),
  message TEXT,
  action_url TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_license_notifications_org ON license_notifications(organization_id);
CREATE INDEX idx_license_notifications_type ON license_notifications(notification_type);
CREATE INDEX idx_license_notifications_status ON license_notifications(status);
CREATE INDEX idx_license_notifications_sent ON license_notifications(sent_at);

-- ========================================
-- Coupon & Discount Codes
-- ========================================

CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Code
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,

  -- Discount
  discount_type VARCHAR(50),                  -- percentage, fixed, free_trial
  discount_amount NUMERIC(12, 2),
  discount_percentage NUMERIC(5, 2),

  -- Application
  applicable_plans TEXT[],                    -- Applicable to specific plans, null = all
  applicable_organizations UUID[],            -- Specific orgs, null = all

  -- Validity
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  max_redemptions INT,
  current_redemptions INT DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'active',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_discount_codes_code ON discount_codes(code);
CREATE INDEX idx_discount_codes_status ON discount_codes(status);

-- ========================================
-- Triggers
-- ========================================

DROP TRIGGER IF EXISTS trg_license_plans_updated ON license_plans;
CREATE TRIGGER trg_license_plans_updated
  BEFORE UPDATE ON license_plans
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_org_licenses_updated ON organization_licenses;
CREATE TRIGGER trg_org_licenses_updated
  BEFORE UPDATE ON organization_licenses
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_license_usage_updated ON license_usage;
CREATE TRIGGER trg_license_usage_updated
  BEFORE UPDATE ON license_usage
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_invoices_updated ON invoices;
CREATE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ========================================
-- RLS Policies
-- ========================================

ALTER TABLE license_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_notifications ENABLE ROW LEVEL SECURITY;

-- License Plans - Public Read
DROP POLICY IF EXISTS "Public can view active plans" ON license_plans;
CREATE POLICY "Public can view active plans"
  ON license_plans
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active' AND NOT hide_from_ui);

-- Organization Licenses - Organization Only
DROP POLICY IF EXISTS "Org members can view their license" ON organization_licenses;
CREATE POLICY "Org members can view their license"
  ON organization_licenses
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage licenses" ON organization_licenses;
CREATE POLICY "Admins can manage licenses"
  ON organization_licenses
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Usage Events - Organization Members
DROP POLICY IF EXISTS "Org members can view usage" ON usage_events;
CREATE POLICY "Org members can view usage"
  ON usage_events
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Invoices - Organization Only
DROP POLICY IF EXISTS "Org members can view invoices" ON invoices;
CREATE POLICY "Org members can view invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ========================================
-- Initial Data
-- ========================================

DELETE FROM license_plans WHERE key IN ('free', 'starter', 'professional', 'enterprise');

INSERT INTO license_plans (
  key, name, description, tier,
  price_monthly, price_annual, currency,
  max_users, max_storage_gb, max_projects, max_api_calls_per_day,
  max_team_members, max_custom_fields, max_integrations, max_workflows,
  features, modules, support_tier, response_time_hours, uptime_sla,
  display_order, popular, recommended, metadata
) VALUES
(
  'free', 'Free', 'Perfect for getting started', 0,
  0, 0, 'USD',
  1, 5, 1, 100,
  0, 0, 0, 0,
  '{"ai": false, "advanced_reporting": false, "custom_domain": false, "sso": false}'::jsonb,
  ARRAY['dashboard', 'basic_projects'],
  'community', NULL, 99.0,
  1, false, false, '{}'::jsonb
),
(
  'starter', 'Starter', 'For small teams and projects', 1,
  29.00, 290.00, 'USD',
  5, 50, 5, 1000,
  5, 10, 2, 5,
  '{"ai": true, "advanced_reporting": false, "custom_domain": false, "sso": false}'::jsonb,
  ARRAY['dashboard', 'projects', 'basic_analytics'],
  'email', 48, 99.5,
  2, false, false, '{}'::jsonb
),
(
  'professional', 'Professional', 'For growing businesses', 2,
  99.00, 990.00, 'USD',
  25, 500, 50, 10000,
  25, 50, 10, 50,
  '{"ai": true, "advanced_reporting": true, "custom_domain": true, "sso": false}'::jsonb,
  ARRAY['dashboard', 'projects', 'analytics', 'reports', 'integrations'],
  'priority', 24, 99.9,
  3, true, true, '{}'::jsonb
),
(
  'enterprise', 'Enterprise', 'For large organizations', 3,
  NULL, NULL, 'USD',
  -1, -1, -1, -1,
  NULL, NULL, NULL, NULL,
  '{"ai": true, "advanced_reporting": true, "custom_domain": true, "sso": true, "api_access": true, "white_label": true}'::jsonb,
  ARRAY['dashboard', 'projects', 'analytics', 'reports', 'integrations', 'admin', 'api'],
  '24x7', 1, 99.99,
  4, false, false, '{}'::jsonb
);
