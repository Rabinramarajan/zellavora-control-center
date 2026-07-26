-- Enterprise Workflow Engine
-- State machine-based workflow system with approval chains, notifications, and full audit trail

-- ========================================
-- Workflow Definitions
-- ========================================

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  key VARCHAR(255) NOT NULL,                    -- e.g., "document-approval", "expense-request"
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Configuration
  initial_state VARCHAR(100) NOT NULL DEFAULT 'draft',
  states JSONB NOT NULL DEFAULT '[]'::jsonb,   -- Array of state definitions with transitions
  version INT DEFAULT 1,

  -- Status
  enabled BOOLEAN DEFAULT true,
  status VARCHAR(50) DEFAULT 'active',         -- active, archived, deprecated

  -- Metadata
  icon VARCHAR(100),
  color VARCHAR(20),
  category VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}',

  -- Audit
  created_by UUID REFERENCES organization_users(id),
  updated_by UUID REFERENCES organization_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, key)
);

CREATE INDEX idx_workflows_org ON workflows(organization_id);
CREATE INDEX idx_workflows_key ON workflows(organization_id, key);
CREATE INDEX idx_workflows_enabled ON workflows(enabled);
CREATE INDEX idx_workflows_status ON workflows(status);

-- ========================================
-- Workflow Instances
-- ========================================

CREATE TABLE IF NOT EXISTS workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

  -- Reference
  entity_type VARCHAR(100) NOT NULL,           -- e.g., "document", "expense_request"
  entity_id UUID NOT NULL,

  -- Current State
  current_state VARCHAR(100) NOT NULL,
  current_state_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Timeline
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,

  -- Progress
  progress INT DEFAULT 0,                      -- 0-100%
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, completed, failed, cancelled

  -- Metadata
  data JSONB DEFAULT '{}'::jsonb,              -- Custom workflow data
  variables JSONB DEFAULT '{}'::jsonb,        -- Runtime variables (filled during execution)
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Participants
  initiator_id UUID REFERENCES organization_users(id),
  assigned_to UUID REFERENCES organization_users(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(entity_type, entity_id, workflow_id)
);

CREATE INDEX idx_workflow_instances_org ON workflow_instances(organization_id);
CREATE INDEX idx_workflow_instances_workflow ON workflow_instances(workflow_id);
CREATE INDEX idx_workflow_instances_entity ON workflow_instances(entity_type, entity_id);
CREATE INDEX idx_workflow_instances_state ON workflow_instances(current_state);
CREATE INDEX idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX idx_workflow_instances_assigned ON workflow_instances(assigned_to);

-- ========================================
-- Workflow State Transitions
-- ========================================

CREATE TABLE IF NOT EXISTS workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,

  -- Transition
  from_state VARCHAR(100) NOT NULL,
  to_state VARCHAR(100) NOT NULL,
  action VARCHAR(100),                         -- e.g., "submit", "approve", "reject"

  -- Metadata
  triggered_by VARCHAR(100),                   -- 'user', 'system', 'api'
  triggered_by_id UUID REFERENCES organization_users(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Comment/Reason
  comment TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_transitions_instance ON workflow_transitions(workflow_instance_id);
CREATE INDEX idx_workflow_transitions_states ON workflow_transitions(from_state, to_state);
CREATE INDEX idx_workflow_transitions_user ON workflow_transitions(triggered_by_id);

-- ========================================
-- Approval Chains
-- ========================================

CREATE TABLE IF NOT EXISTS approval_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

  -- Identity
  key VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Configuration
  type VARCHAR(50) NOT NULL,                   -- sequential, parallel, conditional
  strategy VARCHAR(50) DEFAULT 'unanimous',    -- unanimous, majority, first_approver

  -- Approvers
  approver_ids UUID[],                         -- Specific user IDs
  approver_role VARCHAR(100),                  -- Or role-based
  approver_group VARCHAR(100),                 -- Or group-based

  -- Behavior
  allow_delegation BOOLEAN DEFAULT false,
  allow_rejection BOOLEAN DEFAULT true,
  rejection_state VARCHAR(100),                -- State on rejection
  approval_state VARCHAR(100),                 -- State on approval
  escalation_hours INT,                        -- Auto-escalate after N hours

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, workflow_id, key)
);

CREATE INDEX idx_approval_chains_org ON approval_chains(organization_id);
CREATE INDEX idx_approval_chains_workflow ON approval_chains(workflow_id);

-- ========================================
-- Approvals (Individual Approval Records)
-- ========================================

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  approval_chain_id UUID NOT NULL REFERENCES approval_chains(id) ON DELETE CASCADE,

  -- Approver
  approver_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,
  delegated_to UUID REFERENCES organization_users(id),

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, approved, rejected, delegated, escalated
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,

  -- Comment
  comment TEXT,
  decision_reason TEXT,

  -- Reminders
  reminder_sent_at TIMESTAMPTZ,
  escalation_sent_at TIMESTAMPTZ,

  -- Order (for sequential approval)
  sequence_number INT,
  depends_on UUID REFERENCES approvals(id),   -- For conditional approval

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approvals_instance ON approvals(workflow_instance_id);
CREATE INDEX idx_approvals_approver ON approvals(approver_id);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_chain ON approvals(approval_chain_id);

-- ========================================
-- Workflow History
-- ========================================

CREATE TABLE IF NOT EXISTS workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,

  -- Event
  event_type VARCHAR(100) NOT NULL,            -- state_changed, approval_requested, comment_added, etc.
  event_data JSONB,

  -- Actor
  actor_id UUID REFERENCES organization_users(id),
  actor_type VARCHAR(50),                      -- user, system, api

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_history_instance ON workflow_history(workflow_instance_id);
CREATE INDEX idx_workflow_history_type ON workflow_history(event_type);
CREATE INDEX idx_workflow_history_created ON workflow_history(created_at DESC);

-- ========================================
-- Workflow Audit Logs
-- ========================================

CREATE TABLE IF NOT EXISTS workflow_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Resource
  resource_type VARCHAR(100) NOT NULL,         -- workflow, approval, transition
  resource_id UUID NOT NULL,

  -- Action
  action VARCHAR(100) NOT NULL,                -- created, updated, deleted, started, completed
  old_value JSONB,
  new_value JSONB,

  -- User
  user_id UUID REFERENCES organization_users(id),
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_audit_org ON workflow_audit_logs(organization_id);
CREATE INDEX idx_workflow_audit_resource ON workflow_audit_logs(resource_type, resource_id);
CREATE INDEX idx_workflow_audit_action ON workflow_audit_logs(action);
CREATE INDEX idx_workflow_audit_timestamp ON workflow_audit_logs(created_at DESC);

-- ========================================
-- Workflow Notifications
-- ========================================

CREATE TABLE IF NOT EXISTS workflow_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,

  -- Notification
  notification_type VARCHAR(50) NOT NULL,     -- assigned, approved, rejected, comment, deadline
  recipient_id UUID REFERENCES organization_users(id),

  -- Content
  title VARCHAR(255) NOT NULL,
  message TEXT,
  action_url TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'pending',       -- pending, sent, read, dismissed
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_notifications_instance ON workflow_notifications(workflow_instance_id);
CREATE INDEX idx_workflow_notifications_recipient ON workflow_notifications(recipient_id);
CREATE INDEX idx_workflow_notifications_status ON workflow_notifications(status);

-- ========================================
-- Workflow Comments
-- ========================================

CREATE TABLE IF NOT EXISTS workflow_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,

  -- Comment
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES organization_users(id),

  -- Mentions
  mentions UUID[],
  attachments JSONB DEFAULT '[]'::jsonb,

  -- Reactions
  reactions JSONB DEFAULT '{}'::jsonb,        -- {emoji: [user_ids]}

  -- Status
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_comments_instance ON workflow_comments(workflow_instance_id);
CREATE INDEX idx_workflow_comments_author ON workflow_comments(author_id);

-- ========================================
-- Triggers
-- ========================================

DROP TRIGGER IF EXISTS trg_workflows_updated ON workflows;
CREATE TRIGGER trg_workflows_updated
  BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_workflow_instances_updated ON workflow_instances;
CREATE TRIGGER trg_workflow_instances_updated
  BEFORE UPDATE ON workflow_instances
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_approval_chains_updated ON approval_chains;
CREATE TRIGGER trg_approval_chains_updated
  BEFORE UPDATE ON approval_chains
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_approvals_updated ON approvals;
CREATE TRIGGER trg_approvals_updated
  BEFORE UPDATE ON approvals
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_workflow_comments_updated ON workflow_comments;
CREATE TRIGGER trg_workflow_comments_updated
  BEFORE UPDATE ON workflow_comments
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ========================================
-- RLS Policies
-- ========================================

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_comments ENABLE ROW LEVEL SECURITY;

-- Org members can view workflows
DROP POLICY IF EXISTS "Org members can view workflows" ON workflows;
CREATE POLICY "Org members can view workflows"
  ON workflows
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Org members can view their workflow instances
DROP POLICY IF EXISTS "Org members can view instances" ON workflow_instances;
CREATE POLICY "Org members can view instances"
  ON workflow_instances
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Users can view their approvals
DROP POLICY IF EXISTS "Users can view their approvals" ON approvals;
CREATE POLICY "Users can view their approvals"
  ON approvals
  FOR SELECT
  TO authenticated
  USING (approver_id = auth.uid() OR delegated_to = auth.uid());

-- Users can see notifications for them
DROP POLICY IF EXISTS "Users can view their notifications" ON workflow_notifications;
CREATE POLICY "Users can view their notifications"
  ON workflow_notifications
  FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid() OR organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Admins can manage workflows
DROP POLICY IF EXISTS "Admins can manage workflows" ON workflows;
CREATE POLICY "Admins can manage workflows"
  ON workflows
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );
