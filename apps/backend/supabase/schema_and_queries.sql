-- =============================================================
-- Zellavora Control Center (ZCC) - Database Schema & CRUD Queries
-- Mapped from Swagger/OpenAPI API specification
-- =============================================================

-- -------------------------------------------------------------
-- 0. SCHEMA MIGRATIONS (Runs first to support existing databases)
-- -------------------------------------------------------------

-- Safely add missing columns to existing users table if it exists
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS email_id VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS username VARCHAR(150);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS enable_two_factor_authentication BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS otp VARCHAR(10);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_account_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS last_locked_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS successful_login_attempts INT DEFAULT 0;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS current_login_datetime TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS last_login_datetime TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS default_landing_page VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS password_reset_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS key_token TEXT;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS status_value VARCHAR(50);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS status_description TEXT;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS msg TEXT;

-- Safely add missing columns to existing profiles table if it exists
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS github VARCHAR(255);
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS linkedin VARCHAR(255);
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS twitter VARCHAR(255);

-- Safely add constraints catching any errors (such as missing users table or duplicate constraints)
DO $$
BEGIN
    BEGIN
        ALTER TABLE users ADD CONSTRAINT unique_username UNIQUE (username);
    EXCEPTION 
        WHEN undefined_table OR duplicate_object OR duplicate_table THEN
            NULL; -- Ignore error if table does not exist or constraint already exists
    END;

    BEGIN
        ALTER TABLE users ADD CONSTRAINT unique_email_id UNIQUE (email_id);
    EXCEPTION 
        WHEN undefined_table OR duplicate_object OR duplicate_table THEN
            NULL; -- Ignore error if table does not exist or constraint already exists
    END;
END
$$;

-- -------------------------------------------------------------
-- 1. SQL Table Creations (Standard Setup)
-- -------------------------------------------------------------

-- Tenants (Organizations)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    client_code VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    plan VARCHAR(50) DEFAULT 'free',
    enforce_2fa BOOLEAN DEFAULT FALSE,
    allowed_domains JSONB, -- Stored as JSON array of domains
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users (Updated with Login Fields)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_id VARCHAR(255) UNIQUE, -- Matches requested 'emailId'
    username VARCHAR(150) UNIQUE, -- Matches requested 'userName'
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255), -- Stores securely hashed password
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'user',
    
    -- Login & Security Fields
    enable_two_factor_authentication BOOLEAN DEFAULT FALSE, -- Matches 'enableTwoFactorAuthentication'
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_enrolled_at TIMESTAMP WITH TIME ZONE,
    otp VARCHAR(10), -- Matches requested 'otp' (temporary storage/verification)
    
    is_account_locked BOOLEAN DEFAULT FALSE, -- Matches 'isAccountLocked'
    last_locked_date TIMESTAMP WITH TIME ZONE, -- Matches 'lastLockedDate'
    successful_login_attempts INT DEFAULT 0, -- Matches 'successfulLoginAttempts'
    
    current_login_datetime TIMESTAMP WITH TIME ZONE, -- Matches 'currentLoginDatetime'
    last_login_datetime TIMESTAMP WITH TIME ZONE, -- Matches 'lastLoginDatetime'
    default_landing_page VARCHAR(255), -- Matches 'defaultLandingPage'
    password_reset_flag BOOLEAN DEFAULT FALSE, -- Matches 'passwordResetFlag'
    
    -- API Handshake & Status Tokens
    key_token TEXT, -- Matches 'keyToken'
    status_value VARCHAR(50), -- Matches 'statusValue'
    status_description TEXT, -- Matches 'statusDescription'
    version INT DEFAULT 1, -- Matches 'version'
    msg TEXT, -- Matches 'msg'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User-Tenant Membership
CREATE TABLE IF NOT EXISTS user_tenants (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, tenant_id)
);

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    headline VARCHAR(255),
    location VARCHAR(255),
    website VARCHAR(255),
    github VARCHAR(255),
    linkedin VARCHAR(255),
    twitter VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100),
    status VARCHAR(20) CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
    github_url TEXT,
    live_demo_url TEXT,
    website_url TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project Gallery Images
CREATE TABLE IF NOT EXISTS gallery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    caption VARCHAR(255),
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Technologies Catalog
CREATE TABLE IF NOT EXISTS technologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    icon TEXT,
    color VARCHAR(10), -- Hex color code (e.g. #3178C6)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project-Technologies (Many-to-Many)
CREATE TABLE IF NOT EXISTS project_technologies (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    technology_id UUID REFERENCES technologies(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, technology_id)
);

-- Skills
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    level INT CHECK (level >= 0 AND level <= 100) NOT NULL,
    category VARCHAR(100),
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Experience entries
CREATE TABLE IF NOT EXISTS experiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    company VARCHAR(150) NOT NULL,
    location VARCHAR(150),
    start_date DATE NOT NULL,
    end_date DATE,
    current BOOLEAN DEFAULT FALSE,
    description TEXT,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Education entries
CREATE TABLE IF NOT EXISTS educations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    institution VARCHAR(200) NOT NULL,
    degree VARCHAR(150) NOT NULL,
    field VARCHAR(150),
    start_date DATE NOT NULL,
    end_date DATE,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Service Items
CREATE TABLE IF NOT EXISTS service_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    price DECIMAL(12, 2),
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Testimonials
CREATE TABLE IF NOT EXISTS testimonials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    author_name VARCHAR(150) NOT NULL,
    author_title VARCHAR(150),
    author_avatar TEXT,
    content TEXT NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RBAC Roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(200) NOT NULL,
    description TEXT,
    level INT CHECK (level >= 0 AND level <= 100) DEFAULT 0,
    color VARCHAR(10),
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Role Inheritance Mapping (Many-to-Many self-referencing)
CREATE TABLE IF NOT EXISTS role_inheritances (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    parent_role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, parent_role_id)
);

-- Permission Groups
CREATE TABLE IF NOT EXISTS permission_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Fine-Grained Permissions
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    label VARCHAR(200) NOT NULL,
    group_id UUID REFERENCES permission_groups(id) ON DELETE SET NULL,
    type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Role-Permissions Association
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    effect VARCHAR(10) CHECK (effect IN ('allow', 'deny')) DEFAULT 'allow',
    PRIMARY KEY (role_id, permission_id)
);

-- User Role Assignments (within Tenants)
CREATE TABLE IF NOT EXISTS user_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    resource_type VARCHAR(100),
    resource_id VARCHAR(100),
    valid_until TIMESTAMP WITH TIME ZONE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    organization_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    severity VARCHAR(20) CHECK (severity IN ('info', 'warn', 'critical')) DEFAULT 'info',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Multi-Channel Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255),
    body TEXT NOT NULL,
    channels JSONB, -- Array of strings (e.g. ["email", "in_app"])
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Automation Workflows
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workflow Executions
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    status VARCHAR(20) CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Dynamic Navigation Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL,
    label VARCHAR(150) NOT NULL,
    icon VARCHAR(100),
    route VARCHAR(255),
    external_url TEXT,
    parent_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    order_index INT NOT NULL DEFAULT 0,
    category VARCHAR(100),
    visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Licensing Plans
CREATE TABLE IF NOT EXISTS license_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    features JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tenant Active Licenses
CREATE TABLE IF NOT EXISTS tenant_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES license_plans(id) ON DELETE RESTRICT,
    status VARCHAR(50) DEFAULT 'active',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Branches
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Common Configurations
CREATE TABLE IF NOT EXISTS common_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    key VARCHAR(150) NOT NULL,
    value TEXT NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, key)
);


-- -------------------------------------------------------------
-- 2. SQL Insert Queries (Sample Data)
-- -------------------------------------------------------------

-- 1. Tenant
INSERT INTO tenants (id, name, client_code, logo_url, plan, enforce_2fa, allowed_domains)
VALUES ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Acme Corp', 'acme', 'https://cdn.acme.com/logo.png', 'enterprise', true, '["acme.com", "acme-corp.com"]')
ON CONFLICT (id) DO NOTHING;

-- 2. User
INSERT INTO users (
    id, email, email_id, username, full_name, password_hash, avatar_url, role, 
    enable_two_factor_authentication, mfa_enabled, mfa_enrolled_at, otp,
    is_account_locked, last_locked_date, successful_login_attempts,
    current_login_datetime, last_login_datetime, default_landing_page, password_reset_flag,
    key_token, status_value, status_description, version, msg
)
VALUES (
    '00000000-0000-4000-a000-000000000002', 
    'jane.doe@acme.com', 
    'jane.doe@acme.com', 
    'janedoe123', 
    'Jane Doe', 
    '$2b$12$L8yK5P2.M9vQd4lS7a3b4eR3...', 
    'https://avatar.com/jane.png', 
    'admin', 
    false, 
    false, 
    NULL, 
    NULL,
    false, 
    NULL, 
    0,
    CURRENT_TIMESTAMP, 
    CURRENT_TIMESTAMP, 
    '/dashboard/home', 
    false,
    'jwt-handshake-key-token-example', 
    'ACTIVE', 
    'Account is in good standing', 
    1, 
    'Success'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Membership
INSERT INTO user_tenants (user_id, tenant_id)
VALUES ('00000000-0000-4000-a000-000000000002', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d')
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- 4. Profile
INSERT INTO profiles (id, user_id, bio, headline, location, website, github, linkedin, twitter)
VALUES ('00000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-000000000002', 'Senior Engineering Director at Acme', 'Director of Engineering', 'New York, USA', 'https://janedoe.dev', 'github.com/janedoe', 'linkedin.com/in/janedoe', 'twitter.com/janedoe')
ON CONFLICT (id) DO NOTHING;

-- 5. Project
INSERT INTO projects (id, user_id, title, slug, description, category, status, github_url, live_demo_url, website_url)
VALUES ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000002', 'My Awesome Project', 'my-awesome-project', 'This is a long description of this portfolio project.', 'Web Development', 'published', 'https://github.com/acme/awesome', 'https://awesome.acme.com', 'https://acme.com')
ON CONFLICT (id) DO NOTHING;

-- 6. Gallery Item
INSERT INTO gallery_items (id, project_id, media_url, caption, order_index)
VALUES ('00000000-0000-4000-a000-000000000011', '00000000-0000-4000-a000-000000000003', 'https://images.acme.com/awesome-screenshot.png', 'Main Dashboard UI', 1)
ON CONFLICT (id) DO NOTHING;

-- 7. Technology
INSERT INTO technologies (id, name, icon, color)
VALUES ('00000000-0000-4000-a000-000000000004', 'TypeScript', 'typescript-icon', '#3178C6')
ON CONFLICT (id) DO NOTHING;

-- 8. Project-Technology relation
INSERT INTO project_technologies (project_id, technology_id)
VALUES ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000004')
ON CONFLICT (project_id, technology_id) DO NOTHING;

-- 9. Skill
INSERT INTO skills (id, user_id, name, level, category, order_index)
VALUES ('00000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000002', 'React / Next.js', 95, 'Frontend', 1)
ON CONFLICT (id) DO NOTHING;

-- 10. Experience
INSERT INTO experiences (id, user_id, title, company, location, start_date, current, description, order_index)
VALUES ('00000000-0000-4000-a000-000000000013', '00000000-0000-4000-a000-000000000002', 'Lead Developer', 'Stripe', 'Remote', '2023-01-15', true, 'Building Core Platform Features.', 1)
ON CONFLICT (id) DO NOTHING;

-- 11. Education
INSERT INTO educations (id, user_id, institution, degree, field, start_date, end_date, order_index)
VALUES ('00000000-0000-4000-a000-000000000014', '00000000-0000-4000-a000-000000000002', 'Stanford University', 'B.S.', 'Computer Science', '2015-09-01', '2019-06-15', 1)
ON CONFLICT (id) DO NOTHING;

-- 12. Service
INSERT INTO service_items (id, user_id, title, description, icon, price, order_index)
VALUES ('00000000-0000-4000-a000-000000000015', '00000000-0000-4000-a000-000000000002', 'SaaS Consulting', 'End to end web application design and build', 'code-icon', 2500.00, 1)
ON CONFLICT (id) DO NOTHING;

-- 13. Testimonial
INSERT INTO testimonials (id, user_id, author_name, author_title, author_avatar, content, rating, order_index)
VALUES ('00000000-0000-4000-a000-000000000016', '00000000-0000-4000-a000-000000000002', 'John Smith', 'CEO, VentureCo', 'https://avatar.com/john.png', 'Jane delivered the project ahead of schedule and with unmatched quality!', 5, 1)
ON CONFLICT (id) DO NOTHING;

-- 14. RBAC Role
INSERT INTO roles (id, key, label, description, level, color, is_system)
VALUES ('00000000-0000-4000-a000-000000000005', 'content_editor', 'Content Editor', 'Allows editing of projects and portfolios', 30, '#50FA7B', false)
ON CONFLICT (id) DO NOTHING;

-- 15. Role Inheritance (Self-reference / Example assignment)
INSERT INTO role_inheritances (role_id, parent_role_id)
VALUES ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000005')
ON CONFLICT (role_id, parent_role_id) DO NOTHING;

-- 16. Permission Group
INSERT INTO permission_groups (id, name, description)
VALUES ('00000000-0000-4000-a000-000000000006', 'portfolio_management', 'All permissions related to portfolios and content management')
ON CONFLICT (id) DO NOTHING;

-- 17. Permission
INSERT INTO permissions (id, key, label, group_id, type)
VALUES ('00000000-0000-4000-a000-000000000007', 'content:write', 'Write Content', '00000000-0000-4000-a000-000000000006', 'write')
ON CONFLICT (id) DO NOTHING;

-- 18. Role Permission Effect
INSERT INTO role_permissions (role_id, permission_id, effect)
VALUES ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000007', 'allow')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 19. User Role Assignment
INSERT INTO user_role_assignments (id, user_id, role_id, organization_id, assigned_at)
VALUES ('00000000-0000-4000-a000-000000000017', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000005', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 20. Audit Log
INSERT INTO audit_logs (id, actor_id, action, organization_id, severity, ip_address, user_agent)
VALUES ('00000000-0000-4000-a000-000000000018', '00000000-0000-4000-a000-000000000002', 'USER_LOGIN', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'info', '192.168.1.1', 'Mozilla/5.0')
ON CONFLICT (id) DO NOTHING;

-- 21. Notification
INSERT INTO notifications (id, organization_id, recipient_id, title, body, channels, status)
VALUES ('00000000-0000-4000-a000-000000000019', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', '00000000-0000-4000-a000-000000000002', 'Welcome to ZCC', 'Your account has been initialized.', '["email", "in_app"]', 'pending')
ON CONFLICT (id) DO NOTHING;

-- 22. Automation Workflow
INSERT INTO workflows (id, organization_id, name, description, trigger_type, enabled)
VALUES ('00000000-0000-4000-a000-000000000008', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Auto-Publish Projects', 'Triggers publication approval validation when a draft project changes', 'on_project_create', true)
ON CONFLICT (id) DO NOTHING;

-- 23. Workflow Execution
INSERT INTO workflow_executions (id, workflow_id, status, started_at)
VALUES ('00000000-0000-4000-a000-000000000020', '00000000-0000-4000-a000-000000000008', 'running', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 24. Navigation Menu Item
INSERT INTO menu_items (id, key, label, icon, route, order_index, category, visible)
VALUES ('00000000-0000-4000-a000-000000000021', 'projects_dashboard', 'Projects List', 'briefcase-icon', '/dashboard/projects', 2, 'admin_menu', true)
ON CONFLICT (id) DO NOTHING;

-- 25. License Plan
INSERT INTO license_plans (id, name, price, features)
VALUES ('00000000-0000-4000-a000-000000000009', 'Enterprise Plan', 99.00, '{"max_projects": 100, "custom_domains": true}')
ON CONFLICT (id) DO NOTHING;

-- 26. Tenant License
INSERT INTO tenant_licenses (id, organization_id, plan_id, status, expires_at)
VALUES ('00000000-0000-4000-a000-000000000022', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', '00000000-0000-4000-a000-000000000009', 'active', '2027-01-01 00:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- 27. Branch
INSERT INTO branches (id, organization_id, name, code)
VALUES ('00000000-0000-4000-a000-000000000023', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'New York HQ', 'NY-01')
ON CONFLICT (id) DO NOTHING;

-- 28. Common Configuration
INSERT INTO common_configurations (id, organization_id, key, value, category)
VALUES ('00000000-0000-4000-a000-000000000024', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'DEFAULT_THEME', 'dark', 'branding')
ON CONFLICT (id) DO NOTHING;


-- -------------------------------------------------------------
-- 3. SQL Update Queries
-- -------------------------------------------------------------

-- Example updates are defined here for template use.

-- Update Tenant Plan
-- UPDATE tenants SET plan = 'enterprise', logo_url = 'https://cdn.acme.com/new_logo.png' WHERE id = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

-- Update User Profile Info
-- UPDATE users SET full_name = 'Jane Doe II', avatar_url = 'https://avatar.com/jane2.png' WHERE id = '00000000-0000-4000-a000-000000000002';

-- Update User Biography (Profile details)
-- UPDATE profiles SET bio = 'Updated bio for Jane.', location = 'San Francisco, CA' WHERE user_id = '00000000-0000-4000-a000-000000000002';

-- Update Project Details
-- UPDATE projects SET title = 'Next-Gen CRM', description = 'Modern React & Postgres Client Relationship Manager', status = 'published', updated_at = CURRENT_TIMESTAMP WHERE id = '00000000-0000-4000-a000-000000000003';

-- Update Common Configuration Value
-- UPDATE common_configurations SET value = 'light' WHERE organization_id = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' AND key = 'DEFAULT_THEME';


-- -------------------------------------------------------------
-- 4. SQL Delete Queries
-- -------------------------------------------------------------

-- Example deletes are defined here for template use.

-- Delete a Project (Cascades to gallery_items and project_technologies automatically)
-- DELETE FROM projects WHERE id = '00000000-0000-4000-a000-000000000003';

-- Delete a User (Cascades to profile, user_tenants, projects, etc. automatically)
-- DELETE FROM users WHERE id = '00000000-0000-4000-a000-000000000002';
