-- Enterprise Notification Platform
-- Multi-channel notifications with templates, scheduling, preferences, and real-time delivery

-- ========================================
-- Notification Templates
-- ========================================

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  key VARCHAR(255) NOT NULL,                    -- e.g., "order-shipped", "payment-received"
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Channels
  channels VARCHAR(50)[],                       -- email, sms, whatsapp, push, in_app
  enabled BOOLEAN DEFAULT true,

  -- Content (per channel)
  email_subject VARCHAR(255),
  email_template TEXT,                          -- HTML with {{variables}}
  sms_template TEXT,                            -- Max 160 chars with {{variables}}
  whatsapp_template TEXT,                       -- WhatsApp message template
  push_title VARCHAR(255),
  push_body TEXT,
  in_app_title VARCHAR(255),
  in_app_body TEXT,
  in_app_action_url TEXT,

  -- Metadata
  category VARCHAR(100),                        -- order, payment, security, system, etc.
  priority INT DEFAULT 50,                      -- 0-100, higher = more important
  icon VARCHAR(100),
  color VARCHAR(20),

  -- Retry and Queue
  retry_attempts INT DEFAULT 3,
  retry_delay_seconds INT DEFAULT 60,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_by UUID REFERENCES organization_users(id),
  updated_by UUID REFERENCES organization_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, key)
);

CREATE INDEX idx_notification_templates_org ON notification_templates(organization_id);
CREATE INDEX idx_notification_templates_key ON notification_templates(key);
CREATE INDEX idx_notification_templates_category ON notification_templates(category);

-- ========================================
-- Notifications (Queued/Sent)
-- ========================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,

  -- Recipient
  recipient_id UUID REFERENCES organization_users(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  recipient_push_token VARCHAR(500),

  -- Channel & Status
  channels VARCHAR(50)[],                       -- Channels being used for this notification
  channel_statuses JSONB DEFAULT '{}'::jsonb,  -- {email: 'sent', sms: 'pending', etc.}

  -- Content
  title VARCHAR(255),
  subject VARCHAR(255),
  body TEXT,
  action_url TEXT,
  action_label VARCHAR(100),

  -- Priority & Category
  priority INT DEFAULT 50,
  category VARCHAR(100),

  -- Status
  status VARCHAR(50) DEFAULT 'queued',         -- queued, processing, sent, delivered, failed, cancelled
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  deleted BOOLEAN DEFAULT false,

  -- Scheduling
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Retry
  retry_count INT DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  error_message TEXT,

  -- Tracking
  open_count INT DEFAULT 0,
  click_count INT DEFAULT 0,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  -- Metadata
  variables JSONB DEFAULT '{}'::jsonb,         -- Template variables used
  metadata JSONB DEFAULT '{}'::jsonb,
  user_agent TEXT,
  ip_address INET,

  -- Audit
  created_by UUID REFERENCES organization_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_org ON notifications(organization_id);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_category ON notifications(category);

-- ========================================
-- Notification Preferences
-- ========================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,

  -- Global Settings
  notifications_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  in_app_enabled BOOLEAN DEFAULT true,

  -- Quiet Hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  quiet_hours_timezone VARCHAR(50),

  -- Per-Category Settings
  category_preferences JSONB DEFAULT '{}'::jsonb,  -- {order: {email: true, push: false}, ...}

  -- Frequency
  email_frequency VARCHAR(50) DEFAULT 'instant',   -- instant, hourly, daily, weekly, off
  push_frequency VARCHAR(50) DEFAULT 'instant',
  sms_frequency VARCHAR(50) DEFAULT 'instant',

  -- Digest
  digest_enabled BOOLEAN DEFAULT false,
  digest_frequency VARCHAR(50) DEFAULT 'daily',    -- daily, weekly
  digest_time_of_day TIME,

  -- Contact Info
  email_address VARCHAR(255),
  phone_number VARCHAR(20),
  push_device_tokens TEXT[],                   -- Multiple devices

  -- Unsubscribe
  unsubscribed_categories VARCHAR(100)[],      -- Categories user opted out of
  unsubscribed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX idx_notification_preferences_org ON notification_preferences(organization_id);

-- ========================================
-- Notification Audit Logs
-- ========================================

CREATE TABLE IF NOT EXISTS notification_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,

  -- Action
  action VARCHAR(100) NOT NULL,                -- sent, delivered, failed, opened, clicked, read, deleted
  channel VARCHAR(50),                         -- email, sms, push, in_app

  -- Details
  details JSONB,
  error_details JSONB,

  -- User/System
  user_id UUID REFERENCES organization_users(id),
  actor VARCHAR(50),                           -- 'user', 'system', 'api'

  -- Tracking
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_notification_audit_notification ON notification_audit_logs(notification_id);
CREATE INDEX idx_notification_audit_action ON notification_audit_logs(action);
CREATE INDEX idx_notification_audit_timestamp ON notification_audit_logs(timestamp DESC);

-- ========================================
-- Notification Queue (For Async Processing)
-- ========================================

CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,

  -- Queue Status
  status VARCHAR(50) DEFAULT 'pending',        -- pending, processing, completed, failed, dead_letter
  attempts INT DEFAULT 0,
  next_retry_at TIMESTAMPTZ,

  -- Processing
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,

  -- Error
  error_message TEXT,
  error_code VARCHAR(50),

  -- Metadata
  worker_id VARCHAR(100),                      -- Which worker processed
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_retry ON notification_queue(next_retry_at);

-- ========================================
-- Unread Count (Materialized for Performance)
-- ========================================

CREATE TABLE IF NOT EXISTS user_notification_unread_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES organization_users(id) ON DELETE CASCADE,

  -- Counts
  unread_count INT DEFAULT 0,
  total_count INT DEFAULT 0,

  -- By Category
  category_counts JSONB DEFAULT '{}'::jsonb,  -- {order: 5, payment: 2, etc.}

  -- Last Update
  last_notified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_unread_counts_user ON user_notification_unread_counts(user_id);

-- ========================================
-- Triggers
-- ========================================

DROP TRIGGER IF EXISTS trg_notification_templates_updated ON notification_templates;
CREATE TRIGGER trg_notification_templates_updated
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_notifications_updated ON notifications;
CREATE TRIGGER trg_notifications_updated
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_notification_preferences_updated ON notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_notification_queue_updated ON notification_queue;
CREATE TRIGGER trg_notification_queue_updated
  BEFORE UPDATE ON notification_queue
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Update unread count when notification is read
DROP FUNCTION IF EXISTS update_unread_count CASCADE;
CREATE OR REPLACE FUNCTION update_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.read = true AND OLD.read = false THEN
    UPDATE user_notification_unread_counts
    SET unread_count = unread_count - 1
    WHERE user_id = NEW.recipient_id AND organization_id = NEW.organization_id;
  ELSIF NEW.read = false AND OLD.read = true THEN
    UPDATE user_notification_unread_counts
    SET unread_count = unread_count + 1
    WHERE user_id = NEW.recipient_id AND organization_id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_unread_count ON notifications;
CREATE TRIGGER trg_update_unread_count
  AFTER UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_unread_count();

-- ========================================
-- RLS Policies
-- ========================================

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_unread_counts ENABLE ROW LEVEL SECURITY;

-- Users can view notifications sent to them
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
CREATE POLICY "Users can view their notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

-- Users can update their own notification read status
DROP POLICY IF EXISTS "Users can read their notifications" ON notifications;
CREATE POLICY "Users can read their notifications"
  FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Users can view/update their notification preferences
DROP POLICY IF EXISTS "Users can manage their preferences" ON notification_preferences;
CREATE POLICY "Users can manage their preferences"
  ON notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can see their unread counts
DROP POLICY IF EXISTS "Users can see their unread counts" ON user_notification_unread_counts;
CREATE POLICY "Users can see their unread counts"
  ON user_notification_unread_counts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can manage templates
DROP POLICY IF EXISTS "Admins can manage templates" ON notification_templates;
CREATE POLICY "Admins can manage templates"
  ON notification_templates
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- ========================================
-- Initial Data
-- ========================================

-- Create default notification categories
INSERT INTO notification_templates (
  organization_id, key, name, channels,
  email_subject, email_template,
  sms_template, push_title, push_body,
  in_app_title, in_app_body,
  category, priority, enabled
)
SELECT
  organizations.id,
  'welcome_message',
  'Welcome Message',
  ARRAY['email', 'in_app'],
  'Welcome to {{app_name}}',
  '<p>Hello {{user_name}}, welcome to {{app_name}}!</p>',
  'Welcome to {{app_name}}!',
  'Welcome',
  'Hello {{user_name}}, welcome aboard!',
  'Welcome',
  'Thanks for joining us!',
  'system',
  50,
  true
FROM organizations
ON CONFLICT (organization_id, key) DO NOTHING;
