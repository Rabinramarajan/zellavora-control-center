-- Enterprise Dashboard Platform
-- Modular widget system with permissions, realtime, and advanced analytics

-- ========================================
-- Dashboard Layouts
-- ========================================

CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  key VARCHAR(255) NOT NULL,                    -- dashboard, super-admin, client-admin, etc.
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Role/User
  role_name VARCHAR(100),                       -- If role-specific
  user_id UUID REFERENCES organization_users(id),  -- If user-specific
  is_default BOOLEAN DEFAULT false,

  -- Layout
  layout_type VARCHAR(50) DEFAULT 'grid',       -- grid, flex, custom
  grid_cols INT DEFAULT 12,
  gap INT DEFAULT 16,
  responsive BOOLEAN DEFAULT true,

  -- Content
  sections JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {name, widgets[], order}
  widget_positions JSONB DEFAULT '{}'::jsonb,  -- {widgetId: {x, y, width, height}}
  widget_order TEXT[],                         -- Order of widgets

  -- Settings
  header_visible BOOLEAN DEFAULT true,
  sidebar_visible BOOLEAN DEFAULT true,
  footer_visible BOOLEAN DEFAULT true,
  quick_actions_visible BOOLEAN DEFAULT true,
  notifications_visible BOOLEAN DEFAULT true,

  -- Status
  enabled BOOLEAN DEFAULT true,
  locked BOOLEAN DEFAULT false,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_by UUID REFERENCES organization_users(id),
  updated_by UUID REFERENCES organization_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, key),
  UNIQUE(user_id)
);

CREATE INDEX idx_dashboard_layouts_org ON dashboard_layouts(organization_id);
CREATE INDEX idx_dashboard_layouts_role ON dashboard_layouts(role_name);
CREATE INDEX idx_dashboard_layouts_user ON dashboard_layouts(user_id);
CREATE INDEX idx_dashboard_layouts_default ON dashboard_layouts(is_default) WHERE is_default = true;

-- ========================================
-- Dashboard Widgets (Registry)
-- ========================================

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  key VARCHAR(255) NOT NULL,                    -- total-users, revenue-trend, etc.
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,               -- statistics, charts, tables, activity, health, etc.

  -- Widget Definition
  component_name VARCHAR(255) NOT NULL,         -- Angular component name
  widget_type VARCHAR(50),                      -- card, chart, table, timeline, etc.

  -- Display
  icon VARCHAR(100),
  color VARCHAR(20),
  default_width INT DEFAULT 2,                 -- Grid columns
  default_height INT DEFAULT 2,                -- Grid rows
  min_width INT DEFAULT 1,
  min_height INT DEFAULT 1,
  max_width INT DEFAULT 4,
  max_height INT DEFAULT 4,

  -- Data
  data_source VARCHAR(255),                     -- API endpoint
  data_refresh_interval INT DEFAULT 300000,    -- Milliseconds
  data_cache_time INT DEFAULT 60000,           -- Cache duration

  -- Capabilities
  draggable BOOLEAN DEFAULT true,
  resizable BOOLEAN DEFAULT true,
  removable BOOLEAN DEFAULT true,
  configurable BOOLEAN DEFAULT true,
  fullscreen BOOLEAN DEFAULT false,
  exportable BOOLEAN DEFAULT false,

  -- Permissions
  required_role VARCHAR(100),                   -- Minimum role
  required_permissions TEXT[],                  -- Specific permissions needed
  required_features TEXT[],                     -- Required features/subscription
  license_tier INT,                            -- Minimum license tier

  -- Filters
  default_filters JSONB DEFAULT '{}'::jsonb,   -- Default filter values
  filterable BOOLEAN DEFAULT true,
  available_filters TEXT[],                    -- Filter keys available

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  config_schema JSONB,                         -- JSON schema for configuration

  -- Status
  enabled BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  experimental BOOLEAN DEFAULT false,

  -- Audit
  created_by UUID REFERENCES organization_users(id),
  updated_by UUID REFERENCES organization_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, key)
);

CREATE INDEX idx_dashboard_widgets_org ON dashboard_widgets(organization_id);
CREATE INDEX idx_dashboard_widgets_category ON dashboard_widgets(category);
CREATE INDEX idx_dashboard_widgets_enabled ON dashboard_widgets(enabled) WHERE enabled = true;

-- ========================================
-- User Dashboard Preferences
-- ========================================

CREATE TABLE IF NOT EXISTS dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,

  -- Layout
  layout_id UUID REFERENCES dashboard_layouts(id),
  custom_layout JSONB,                         -- Custom layout override

  -- Display
  theme VARCHAR(50) DEFAULT 'auto',            -- light, dark, auto
  compact_mode BOOLEAN DEFAULT false,
  density VARCHAR(50) DEFAULT 'normal',        -- compact, normal, spacious

  -- Behavior
  auto_refresh BOOLEAN DEFAULT true,
  realtime_updates BOOLEAN DEFAULT true,
  chart_animations BOOLEAN DEFAULT true,

  -- Personalisation
  hidden_widgets TEXT[],                       -- Widget IDs to hide
  pinned_widgets TEXT[],                       -- Widget IDs pinned to top
  favorite_dashboards TEXT[],                  -- Dashboard keys in favorites
  recently_viewed JSONB DEFAULT '[]'::jsonb,  -- [{key, name, timestamp}]

  -- Language & Timezone
  language VARCHAR(50),
  timezone VARCHAR(100),
  date_format VARCHAR(50),
  time_format VARCHAR(50),

  -- Notifications
  notifications_enabled BOOLEAN DEFAULT true,
  notification_sound BOOLEAN DEFAULT true,
  daily_digest BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_dashboard_preferences_user ON dashboard_preferences(user_id);
CREATE INDEX idx_dashboard_preferences_layout ON dashboard_preferences(layout_id);

-- ========================================
-- Dashboard Widget Instances (Personalized)
-- ========================================

CREATE TABLE IF NOT EXISTS dashboard_widget_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  layout_id UUID NOT NULL REFERENCES dashboard_layouts(id) ON DELETE CASCADE,
  widget_id UUID NOT NULL REFERENCES dashboard_widgets(id) ON DELETE CASCADE,

  -- Position
  position_x INT,
  position_y INT,
  width INT,
  height INT,
  order_index INT,

  -- Configuration
  title_override VARCHAR(255),                 -- Custom title
  subtitle_override VARCHAR(255),
  config JSONB DEFAULT '{}'::jsonb,           -- Widget-specific config
  filters JSONB DEFAULT '{}'::jsonb,          -- Applied filters

  -- State
  visible BOOLEAN DEFAULT true,
  locked BOOLEAN DEFAULT false,
  loading BOOLEAN DEFAULT false,
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboard_widget_instances_layout ON dashboard_widget_instances(layout_id);
CREATE INDEX idx_dashboard_widget_instances_widget ON dashboard_widget_instances(widget_id);

-- ========================================
-- Dashboard Analytics & Cache
-- ========================================

CREATE TABLE IF NOT EXISTS dashboard_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  widget_id UUID REFERENCES dashboard_widgets(id) ON DELETE CASCADE,

  -- Metric
  metric_key VARCHAR(255),
  metric_value NUMERIC,

  -- Timestamp
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,

  -- Metadata
  tags JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboard_metrics_org ON dashboard_metrics(organization_id);
CREATE INDEX idx_dashboard_metrics_widget ON dashboard_metrics(widget_id);
CREATE INDEX idx_dashboard_metrics_period ON dashboard_metrics(period_start, period_end);

CREATE TABLE IF NOT EXISTS dashboard_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_key VARCHAR(255),
  data_hash VARCHAR(64),
  cached_data JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INT DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboard_cache_key ON dashboard_cache(widget_key);
CREATE INDEX idx_dashboard_cache_expires ON dashboard_cache(expires_at);

-- ========================================
-- Dashboard Activity Log
-- ========================================

CREATE TABLE IF NOT EXISTS dashboard_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES organization_users(id),

  -- Action
  action VARCHAR(100),                         -- view, configure, export, filter, etc.
  entity_type VARCHAR(100),                    -- dashboard, widget, report, etc.
  entity_id VARCHAR(255),

  -- Details
  details JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboard_activity_org ON dashboard_activity(organization_id);
CREATE INDEX idx_dashboard_activity_user ON dashboard_activity(user_id);
CREATE INDEX idx_dashboard_activity_entity ON dashboard_activity(entity_type, entity_id);

-- ========================================
-- Dashboard Reports
-- ========================================

CREATE TABLE IF NOT EXISTS dashboard_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES organization_users(id),

  -- Identity
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Configuration
  layout_snapshot JSONB,                       -- Snapshot of layout at report creation
  widgets JSONB,                               -- Widgets included
  date_range JSONB,                            -- {from, to}
  filters JSONB DEFAULT '{}',                  -- Applied filters

  -- Format
  format VARCHAR(50),                          -- pdf, excel, csv, json
  include_charts BOOLEAN DEFAULT true,
  include_tables BOOLEAN DEFAULT true,
  include_data BOOLEAN DEFAULT true,

  -- Scheduling
  scheduled BOOLEAN DEFAULT false,
  schedule_cron VARCHAR(255),                  -- Cron expression
  recipients TEXT[],                           -- Email recipients
  last_sent_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,

  -- Status
  status VARCHAR(50) DEFAULT 'draft',         -- draft, active, archived
  generated_count INT DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_by UUID REFERENCES organization_users(id),
  updated_by UUID REFERENCES organization_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboard_reports_org ON dashboard_reports(organization_id);
CREATE INDEX idx_dashboard_reports_user ON dashboard_reports(user_id);
CREATE INDEX idx_dashboard_reports_scheduled ON dashboard_reports(scheduled) WHERE scheduled = true;

-- ========================================
-- Dashboard Filters (Saved)
-- ========================================

CREATE TABLE IF NOT EXISTS dashboard_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES organization_users(id),

  -- Identity
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Filter Definition
  filters JSONB NOT NULL,                      -- {dateRange, dimensions, measures}

  -- Usage
  is_default BOOLEAN DEFAULT false,
  shared_with TEXT[],                          -- User IDs or roles

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboard_filters_org ON dashboard_filters(organization_id);
CREATE INDEX idx_dashboard_filters_user ON dashboard_filters(user_id);

-- ========================================
-- RLS Policies
-- ========================================

ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widget_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_filters ENABLE ROW LEVEL SECURITY;

-- Users can view dashboards for their organization
DROP POLICY IF EXISTS "Users can view dashboards" ON dashboard_layouts;
CREATE POLICY "Users can view dashboards"
  ON dashboard_layouts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Users can view their preferences
DROP POLICY IF EXISTS "Users can view their preferences" ON dashboard_preferences;
CREATE POLICY "Users can view their preferences"
  ON dashboard_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can manage widgets
DROP POLICY IF EXISTS "Admins can manage widgets" ON dashboard_widgets;
CREATE POLICY "Admins can manage widgets"
  ON dashboard_widgets
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Users can view reports for their organization
DROP POLICY IF EXISTS "Users can view reports" ON dashboard_reports;
CREATE POLICY "Users can view reports"
  ON dashboard_reports
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
