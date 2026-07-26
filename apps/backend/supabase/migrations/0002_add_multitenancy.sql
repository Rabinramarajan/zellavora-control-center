-- ============================================================================
-- Zellavora Control Center - Multi-Tenancy & Enterprise Features
-- ============================================================================
-- This migration adds:
-- 1. Organizations (tenants) with isolation
-- 2. Organization membership with roles
-- 3. Tenant invitations
-- 4. Audit logging
-- 5. Password reset tokens
-- 6. API key management
-- 7. Session tracking
-- 8. Soft deletes support
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE organization_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');
CREATE TYPE audit_action AS ENUM (
  'login', 'logout', 'password_change', 'email_verified',
  'user_created', 'user_updated', 'user_deleted',
  'permission_updated', 'role_changed',
  'api_key_created', 'api_key_deleted',
  'resource_created', 'resource_updated', 'resource_deleted'
);

-- ============================================================================
-- ORGANIZATIONS (TENANTS)
-- ============================================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  website_url VARCHAR(255),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Subscription/Plan
  plan VARCHAR(50) DEFAULT 'free', -- free, pro, enterprise
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, suspended, trial
  max_members INTEGER DEFAULT 5,
  max_projects INTEGER DEFAULT 10,
  max_storage_gb INTEGER DEFAULT 1,

  -- Settings
  enforce_sso BOOLEAN DEFAULT false,
  enforce_2fa BOOLEAN DEFAULT false,
  allowed_domains TEXT[], -- For SSO domain restriction

  -- Encryption
  encryption_key_id VARCHAR(255), -- Reference to KMS key

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ, -- Soft delete

  CONSTRAINT valid_plan CHECK (plan IN ('free', 'pro', 'enterprise')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'suspended', 'trial'))
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_organizations_deleted_at ON organizations(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- USERS - ENHANCED WITH TENANT SUPPORT
-- ============================================================================

-- Add tenant awareness to existing users table
ALTER TABLE users ADD COLUMN tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255); -- bcrypt hash
ALTER TABLE users ADD COLUMN last_password_changed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255); -- TOTP secret (encrypted)
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ; -- Soft delete

-- Create index for tenant lookup
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- ORGANIZATION MEMBERS
-- ============================================================================

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role organization_role DEFAULT 'member',

  -- Audit
  invited_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ, -- Soft delete

  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_organization_members_organization_id ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_organization_members_role ON organization_members(role);
CREATE INDEX idx_organization_members_deleted_at ON organization_members(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- ORGANIZATION INVITATIONS
-- ============================================================================

CREATE TABLE organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role organization_role DEFAULT 'member',
  status invitation_status DEFAULT 'pending',

  -- Token management
  token VARCHAR(255) UNIQUE NOT NULL,
  token_expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),

  -- Tracking
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT valid_invitation_status CHECK (status IN ('pending', 'accepted', 'rejected', 'expired'))
);

CREATE INDEX idx_organization_invitations_organization_id ON organization_invitations(organization_id);
CREATE INDEX idx_organization_invitations_email ON organization_invitations(email);
CREATE INDEX idx_organization_invitations_token ON organization_invitations(token);
CREATE INDEX idx_organization_invitations_status ON organization_invitations(status);

-- ============================================================================
-- SESSION MANAGEMENT
-- ============================================================================

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Session tracking
  session_token VARCHAR(255) UNIQUE NOT NULL,
  refresh_token_hash VARCHAR(255), -- Hash of refresh token

  -- Connection info
  ip_address INET,
  user_agent TEXT,
  device_fingerprint VARCHAR(255),

  -- Lifetime
  created_at TIMESTAMPTZ DEFAULT now(),
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  revoked_at TIMESTAMPTZ,

  UNIQUE(user_id, session_token)
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_organization_id ON sessions(organization_id);
CREATE INDEX idx_sessions_session_token ON sessions(session_token);
CREATE INDEX idx_sessions_revoked_at ON sessions(revoked_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ============================================================================
-- PASSWORD RESET TOKENS
-- ============================================================================

CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '15 minutes'),
  used_at TIMESTAMPTZ,

  UNIQUE(user_id, email)
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- ============================================================================
-- API KEYS
-- ============================================================================

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Security
  key_hash VARCHAR(255) UNIQUE NOT NULL, -- bcrypt hash of actual key
  key_preview VARCHAR(20) NOT NULL, -- First 8 + last 4 chars for display

  -- Permissions
  scopes TEXT[] NOT NULL, -- e.g., 'projects:read', 'projects:write', 'analytics:read'
  ip_whitelist INET[],

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,

  UNIQUE(organization_id, name)
);

CREATE INDEX idx_api_keys_organization_id ON api_keys(organization_id);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_revoked_at ON api_keys(revoked_at) WHERE revoked_at IS NULL;

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Event details
  action audit_action NOT NULL,
  resource_type VARCHAR(100), -- 'user', 'project', 'api_key', etc.
  resource_id UUID,
  description TEXT,

  -- State tracking
  old_values JSONB, -- Before state
  new_values JSONB, -- After state

  -- Connection
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_action CHECK (
    action IN (
      'login', 'logout', 'password_change', 'email_verified',
      'user_created', 'user_updated', 'user_deleted',
      'permission_updated', 'role_changed',
      'api_key_created', 'api_key_deleted',
      'resource_created', 'resource_updated', 'resource_deleted'
    )
  )
);

CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================================
-- ADD TENANT COLUMNS TO EXISTING TABLES
-- ============================================================================

ALTER TABLE profiles ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE skills ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE experience ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE education ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE services ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE testimonials ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE projects ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE blog_categories ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE blog_posts ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE media_files ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE technologies ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add deleted_at for soft deletes
ALTER TABLE profiles ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE skills ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE experience ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE education ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE services ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE testimonials ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE blog_categories ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE blog_posts ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE media_files ADD COLUMN deleted_at TIMESTAMPTZ;

-- Add tenant indexes
CREATE INDEX idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX idx_skills_organization_id ON skills(organization_id);
CREATE INDEX idx_experience_organization_id ON experience(organization_id);
CREATE INDEX idx_education_organization_id ON education(organization_id);
CREATE INDEX idx_services_organization_id ON services(organization_id);
CREATE INDEX idx_testimonials_organization_id ON testimonials(organization_id);
CREATE INDEX idx_projects_organization_id ON projects(organization_id);
CREATE INDEX idx_blog_categories_organization_id ON blog_categories(organization_id);
CREATE INDEX idx_blog_posts_organization_id ON blog_posts(organization_id);
CREATE INDEX idx_media_files_organization_id ON media_files(organization_id);
CREATE INDEX idx_technologies_organization_id ON technologies(organization_id);

-- Add deleted_at indexes
CREATE INDEX idx_profiles_deleted_at ON profiles(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_skills_deleted_at ON skills(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_experience_deleted_at ON experience(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_education_deleted_at ON education(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_services_deleted_at ON services(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_testimonials_deleted_at ON testimonials(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_blog_categories_deleted_at ON blog_categories(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_blog_posts_deleted_at ON blog_posts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_files_deleted_at ON media_files(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- PERMISSIONS/ROLES TABLE
-- ============================================================================

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Permissions JSON array: ['projects:read', 'projects:write', ...]
  permissions TEXT[] NOT NULL DEFAULT '{}',

  -- Is this a built-in role (owner, admin, member)?
  is_builtin BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organization_id, name)
);

CREATE INDEX idx_roles_organization_id ON roles(organization_id);

-- Built-in permissions mapping
CREATE TABLE permission_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name VARCHAR(100) NOT NULL,
  permission VARCHAR(100) NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(role_name, permission)
);

-- Populate built-in permissions
INSERT INTO permission_matrix (role_name, permission) VALUES
  ('owner', 'organization:manage'),
  ('owner', 'members:manage'),
  ('owner', 'billing:manage'),
  ('owner', 'settings:manage'),
  ('owner', 'projects:create'),
  ('owner', 'projects:read'),
  ('owner', 'projects:write'),
  ('owner', 'projects:delete'),
  ('owner', 'analytics:read'),
  ('owner', 'audit:read'),
  ('owner', 'api_keys:manage'),

  ('admin', 'members:manage'),
  ('admin', 'settings:manage'),
  ('admin', 'projects:create'),
  ('admin', 'projects:read'),
  ('admin', 'projects:write'),
  ('admin', 'projects:delete'),
  ('admin', 'analytics:read'),
  ('admin', 'audit:read'),

  ('member', 'projects:create'),
  ('member', 'projects:read'),
  ('member', 'projects:write'),
  ('member', 'profile:read'),
  ('member', 'profile:write');
