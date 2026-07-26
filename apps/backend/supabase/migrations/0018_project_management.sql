-- Enterprise Project Management System
-- 28+ tables supporting complete project lifecycle

-- ========================================
-- Core Project Tables
-- ========================================

CREATE TABLE IF NOT EXISTS project_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(100),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, key)
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  project_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255),

  -- Classification
  type_id UUID REFERENCES project_types(id),
  category VARCHAR(100),
  subcategory VARCHAR(100),
  client_id UUID REFERENCES organizations(id),
  department_id UUID,

  -- Status & Priority
  status VARCHAR(50) DEFAULT 'draft',
  priority INT DEFAULT 50,
  risk_level VARCHAR(50),
  complexity VARCHAR(50),
  visibility VARCHAR(50) DEFAULT 'private',

  -- Team & Management
  owner_id UUID NOT NULL REFERENCES organization_users(id),
  project_manager_id UUID REFERENCES organization_users(id),

  -- Budget
  budget NUMERIC(15,2),
  currency VARCHAR(3),
  billing_type VARCHAR(50),
  estimated_cost NUMERIC(15,2),
  actual_cost NUMERIC(15,2),

  -- Timeline
  start_date DATE,
  end_date DATE,
  expected_delivery DATE,
  timezone VARCHAR(100),

  -- Metadata
  country VARCHAR(2),
  language VARCHAR(10),
  version VARCHAR(50),
  color_theme VARCHAR(20),

  -- Resources
  icon VARCHAR(255),
  logo VARCHAR(255),
  banner_image VARCHAR(255),
  thumbnail VARCHAR(255),

  -- Content
  description TEXT,
  short_description VARCHAR(500),
  objectives TEXT,
  business_goals TEXT,
  success_criteria TEXT,

  -- Links
  repository_url VARCHAR(500),
  live_url VARCHAR(500),
  staging_url VARCHAR(500),
  docs_url VARCHAR(500),
  support_url VARCHAR(500),
  license VARCHAR(100),

  -- Flags
  featured BOOLEAN DEFAULT false,
  published_to_portfolio BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  deleted BOOLEAN DEFAULT false,

  -- Audit
  created_by UUID REFERENCES organization_users(id),
  updated_by UUID REFERENCES organization_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, project_code),
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_type ON projects(type_id);
CREATE INDEX idx_projects_featured ON projects(featured) WHERE featured = true;
CREATE INDEX idx_projects_portfolio ON projects(published_to_portfolio) WHERE published_to_portfolio = true;

-- ========================================
-- Project Team Management
-- ========================================

CREATE TABLE IF NOT EXISTS project_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  role_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions TEXT[],
  is_custom BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, role_name)
);

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES project_roles(id),

  role_name VARCHAR(100),
  responsibilities TEXT,
  permissions TEXT[],
  allocation_percentage INT DEFAULT 100,

  joining_date DATE NOT NULL,
  leaving_date DATE,
  availability_status VARCHAR(50) DEFAULT 'available',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- ========================================
-- Work Breakdown Structure
-- ========================================

CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  milestone_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  milestone_type VARCHAR(50),

  status VARCHAR(50) DEFAULT 'planned',
  priority INT DEFAULT 50,

  start_date DATE,
  target_date DATE,
  achieved_date DATE,

  deliverables TEXT[],
  success_criteria TEXT[],

  owner_id UUID REFERENCES organization_users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, milestone_code)
);

CREATE TABLE IF NOT EXISTS project_epics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES project_milestones(id),

  epic_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,

  status VARCHAR(50) DEFAULT 'draft',
  priority INT DEFAULT 50,

  owner_id UUID REFERENCES organization_users(id),
  assigned_to UUID REFERENCES organization_users(id),

  start_date DATE,
  end_date DATE,
  estimated_effort NUMERIC(10,2),
  actual_effort NUMERIC(10,2),
  progress_percentage INT DEFAULT 0,

  depends_on UUID[],
  blocks UUID[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, epic_code)
);

CREATE TABLE IF NOT EXISTS project_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epic_id UUID NOT NULL REFERENCES project_epics(id) ON DELETE CASCADE,

  feature_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,

  status VARCHAR(50) DEFAULT 'draft',
  priority INT DEFAULT 50,

  story_points INT,
  acceptance_criteria TEXT[],
  technical_spec TEXT,

  owner_id UUID REFERENCES organization_users(id),
  assigned_to UUID REFERENCES organization_users(id),

  start_date DATE,
  end_date DATE,

  depends_on UUID[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id UUID REFERENCES project_features(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  task_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,

  status VARCHAR(50) DEFAULT 'todo',
  priority INT DEFAULT 50,
  complexity VARCHAR(50),

  assigned_to UUID REFERENCES organization_users(id),

  estimated_hours NUMERIC(8,2),
  actual_hours NUMERIC(8,2),

  start_date DATE,
  due_date DATE,
  completed_date DATE,

  depends_on UUID[],
  blocking UUID[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, task_code)
);

CREATE TABLE IF NOT EXISTS project_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,

  subtask_code VARCHAR(50),
  title VARCHAR(255) NOT NULL,

  status VARCHAR(50) DEFAULT 'todo',
  assigned_to UUID REFERENCES organization_users(id),

  estimated_hours NUMERIC(8,2),
  actual_hours NUMERIC(8,2),

  completed_date DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================
-- Issues, Bugs, Risks
-- ========================================

CREATE TABLE IF NOT EXISTS project_bugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  bug_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(50) NOT NULL,

  status VARCHAR(50) DEFAULT 'open',
  priority INT DEFAULT 50,

  environment VARCHAR(100),
  steps_to_reproduce TEXT,

  reported_by UUID REFERENCES organization_users(id),
  assigned_to UUID REFERENCES organization_users(id),
  fixed_by UUID REFERENCES organization_users(id),

  fix_version VARCHAR(50),

  created_date DATE NOT NULL,
  resolved_date DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, bug_code)
);

CREATE TABLE IF NOT EXISTS project_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  issue_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,

  status VARCHAR(50) DEFAULT 'open',
  priority INT DEFAULT 50,

  assigned_to UUID REFERENCES organization_users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, issue_code)
);

CREATE TABLE IF NOT EXISTS project_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  risk_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,

  probability VARCHAR(50),
  impact VARCHAR(50),
  mitigation_strategy TEXT,

  status VARCHAR(50) DEFAULT 'identified',
  owner_id UUID REFERENCES organization_users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, risk_code)
);

CREATE TABLE IF NOT EXISTS project_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  source_id UUID NOT NULL,
  target_id UUID NOT NULL,
  dependency_type VARCHAR(50),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================
-- Planning & Releases
-- ========================================

CREATE TABLE IF NOT EXISTS project_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  sprint_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,

  status VARCHAR(50) DEFAULT 'planned',

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_days INT,

  goals TEXT[],
  velocity INT,
  capacity INT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, sprint_code)
);

CREATE TABLE IF NOT EXISTS project_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  release_code VARCHAR(50) NOT NULL,
  version VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,

  status VARCHAR(50) DEFAULT 'planned',

  plan_date DATE,
  release_date DATE,

  changelog TEXT,
  notes TEXT,
  artifacts VARCHAR(255)[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, version)
);

CREATE TABLE IF NOT EXISTS project_backlog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  item_code VARCHAR(50) NOT NULL,
  item_type VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  description TEXT,

  priority INT DEFAULT 50,
  effort_estimate NUMERIC(8,2),
  business_value INT,

  backlog_order INT,
  ready_for_sprint BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, item_code)
);

-- ========================================
-- Documentation & Media
-- ========================================

CREATE TABLE IF NOT EXISTS project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  doc_code VARCHAR(50) NOT NULL,
  doc_type VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  content TEXT,

  version INT DEFAULT 1,
  status VARCHAR(50) DEFAULT 'draft',

  created_by UUID REFERENCES organization_users(id),
  updated_by UUID REFERENCES organization_users(id),

  tags TEXT[],
  categories TEXT[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, doc_code)
);

CREATE TABLE IF NOT EXISTS project_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  media_type VARCHAR(100),
  file_path VARCHAR(500) NOT NULL,
  thumbnail_path VARCHAR(500),

  title VARCHAR(255),
  description TEXT,

  file_size INT,
  mime_type VARCHAR(100),

  width INT,
  height INT,

  tags TEXT[],
  sort_order INT,
  visibility VARCHAR(50) DEFAULT 'public',

  uploaded_by UUID REFERENCES organization_users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================
-- Technologies & Integration
-- ========================================

CREATE TABLE IF NOT EXISTS project_technologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  category VARCHAR(100) NOT NULL,
  technology_name VARCHAR(255) NOT NULL,
  version VARCHAR(50),

  status VARCHAR(50) DEFAULT 'active',
  primary_use VARCHAR(255),
  critical_component BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, category, technology_name)
);

CREATE TABLE IF NOT EXISTS project_repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  provider VARCHAR(50),
  repository_url VARCHAR(500) NOT NULL,

  api_key_encrypted VARCHAR(500),

  branch_mapping JSONB,
  sync_enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,

  commit_count INT DEFAULT 0,
  pr_count INT DEFAULT 0,
  release_count INT DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  link_type VARCHAR(100),
  url VARCHAR(500) NOT NULL,
  title VARCHAR(255),
  description TEXT,

  status VARCHAR(50) DEFAULT 'active',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================
-- Analytics & Audit
-- ========================================

CREATE TABLE IF NOT EXISTS project_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  metric_key VARCHAR(255) NOT NULL,
  metric_value NUMERIC,

  period_start DATE,
  period_end DATE,
  aggregation_type VARCHAR(50),

  tags JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  user_id UUID REFERENCES organization_users(id),

  action VARCHAR(100),
  entity_type VARCHAR(100),
  entity_id UUID,

  details JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  user_id UUID REFERENCES organization_users(id),
  action VARCHAR(100) NOT NULL,

  entity_type VARCHAR(100),
  entity_id UUID,

  old_value JSONB,
  new_value JSONB,

  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_audit_logs_project ON project_audit_logs(project_id);
CREATE INDEX idx_project_audit_logs_user ON project_audit_logs(user_id);
CREATE INDEX idx_project_audit_logs_timestamp ON project_audit_logs(created_at DESC);

-- ========================================
-- RLS Policies
-- ========================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_epics ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_bugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can view projects in their organization
DROP POLICY IF EXISTS "Users can view projects" ON projects;
CREATE POLICY "Users can view projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Users can edit projects they own or manage
DROP POLICY IF EXISTS "Users can edit projects" ON projects;
CREATE POLICY "Users can edit projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    project_manager_id = auth.uid() OR
    id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid() AND role_name IN ('owner', 'manager', 'admin')
    )
  );

-- Users can view tasks they're assigned to
DROP POLICY IF EXISTS "Users can view tasks" ON project_tasks;
CREATE POLICY "Users can view tasks"
  ON project_tasks
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Admins can manage all project data
DROP POLICY IF EXISTS "Admins can manage projects" ON projects;
CREATE POLICY "Admins can manage projects"
  ON projects
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- ========================================
-- Indexes for Performance
-- ========================================

CREATE INDEX idx_project_epics_project ON project_epics(project_id);
CREATE INDEX idx_project_epics_status ON project_epics(status);
CREATE INDEX idx_project_features_epic ON project_features(epic_id);
CREATE INDEX idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_status ON project_tasks(status);
CREATE INDEX idx_project_tasks_assigned ON project_tasks(assigned_to);
CREATE INDEX idx_project_bugs_project ON project_bugs(project_id);
CREATE INDEX idx_project_bugs_status ON project_bugs(status);
CREATE INDEX idx_project_sprints_project ON project_sprints(project_id);
CREATE INDEX idx_project_releases_project ON project_releases(project_id);
CREATE INDEX idx_project_documents_project ON project_documents(project_id);
CREATE INDEX idx_project_media_project ON project_media(project_id);
CREATE INDEX idx_project_analytics_project ON project_analytics(project_id);
CREATE INDEX idx_project_technologies_project ON project_technologies(project_id);
CREATE INDEX idx_project_repositories_project ON project_repositories(project_id);
