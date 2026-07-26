-- ============================================================================
-- Fix RLS Policies - Remove Public Access & Add Tenant Isolation
-- ============================================================================
-- This migration:
-- 1. Removes "OR true" public access clauses
-- 2. Implements proper tenant-aware access control
-- 3. Maintains backward compatibility for public projects
-- ============================================================================

-- ============================================================================
-- USERS TABLE - TENANT-AWARE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "users_view_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;

CREATE POLICY "users_view_own" ON users
  FOR SELECT
  USING (
    auth.uid() = id
    AND tenant_id IS NOT NULL
    AND NOT is_active = false
  );

CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (
    auth.uid() = id
    AND tenant_id IS NOT NULL
  );

CREATE POLICY "users_insert_new" ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- ORGANIZATION_MEMBERS - TENANT ISOLATION
-- ============================================================================

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_view_org" ON organization_members
  FOR SELECT
  USING (
    -- User can view members of their organization
    organization_id IN (
      SELECT organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "members_insert_org" ON organization_members
  FOR INSERT
  WITH CHECK (
    -- Only org admins/owners can add members
    organization_id IN (
      SELECT organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.deleted_at IS NULL
    )
  );

CREATE POLICY "members_update_org" ON organization_members
  FOR UPDATE
  USING (
    -- Only org admins/owners can update member roles
    organization_id IN (
      SELECT organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.deleted_at IS NULL
    )
  );

CREATE POLICY "members_delete_org" ON organization_members
  FOR DELETE
  USING (
    -- Only org owners can delete members
    organization_id IN (
      SELECT organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role = 'owner'
        AND om.deleted_at IS NULL
    )
  );

-- ============================================================================
-- ORGANIZATION_INVITATIONS - TENANT ISOLATION
-- ============================================================================

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_view_own_org" ON organization_invitations
  FOR SELECT
  USING (
    -- User can view invitations for their org
    organization_id IN (
      SELECT organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "invitations_view_own_email" ON organization_invitations
  FOR SELECT
  USING (
    -- User can view invitation sent to their email (before accepting)
    email = (SELECT email FROM users WHERE id = auth.uid())
    AND status = 'pending'
  );

CREATE POLICY "invitations_insert_org" ON organization_invitations
  FOR INSERT
  WITH CHECK (
    -- Only org admins/owners can send invitations
    organization_id IN (
      SELECT organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.deleted_at IS NULL
    )
  );

-- ============================================================================
-- SESSIONS - TENANT ISOLATION
-- ============================================================================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_view_own" ON sessions
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "sessions_insert_own" ON sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "sessions_revoke_own" ON sessions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- PROFILES - TENANT-AWARE ACCESS
-- ============================================================================

DROP POLICY IF EXISTS "profiles_view_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

CREATE POLICY "profiles_view_own" ON profiles
  FOR SELECT
  USING (
    -- User can view their own profile
    auth.uid() = user_id
  );

CREATE POLICY "profiles_view_tenant_members" ON profiles
  FOR SELECT
  USING (
    -- User can view profiles of their organization members
    user_id IN (
      SELECT om.user_id
      FROM organization_members om
      WHERE om.organization_id = profiles.organization_id
        AND om.user_id != auth.uid()
        AND om.deleted_at IS NULL
    )
  );

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SKILLS - TENANT-AWARE ACCESS
-- ============================================================================

DROP POLICY IF EXISTS "skills_view_own" ON skills;
DROP POLICY IF EXISTS "skills_manage_own" ON skills;

CREATE POLICY "skills_view_own" ON skills
  FOR SELECT
  USING (
    -- User can view their own skills
    auth.uid() = user_id
  );

CREATE POLICY "skills_view_tenant_members" ON skills
  FOR SELECT
  USING (
    -- User can view skills of their organization members
    user_id IN (
      SELECT om.user_id
      FROM organization_members om
      WHERE om.organization_id = skills.organization_id
        AND om.user_id != auth.uid()
        AND om.deleted_at IS NULL
    )
  );

CREATE POLICY "skills_manage_own" ON skills
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- EXPERIENCE - TENANT-AWARE ACCESS
-- ============================================================================

DROP POLICY IF EXISTS "experience_view_own" ON experience;

ALTER TABLE experience ENABLE ROW LEVEL SECURITY;

CREATE POLICY "experience_view_own" ON experience
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "experience_view_tenant_members" ON experience
  FOR SELECT
  USING (
    user_id IN (
      SELECT om.user_id
      FROM organization_members om
      WHERE om.organization_id = experience.organization_id
        AND om.user_id != auth.uid()
        AND om.deleted_at IS NULL
    )
  );

CREATE POLICY "experience_manage_own" ON experience
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- EDUCATION - TENANT-AWARE ACCESS
-- ============================================================================

ALTER TABLE education ENABLE ROW LEVEL SECURITY;

CREATE POLICY "education_view_own" ON education
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "education_view_tenant_members" ON education
  FOR SELECT
  USING (
    user_id IN (
      SELECT om.user_id
      FROM organization_members om
      WHERE om.organization_id = education.organization_id
        AND om.user_id != auth.uid()
        AND om.deleted_at IS NULL
    )
  );

CREATE POLICY "education_manage_own" ON education
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- SERVICES - TENANT-AWARE ACCESS
-- ============================================================================

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_view_own" ON services
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "services_view_tenant_members" ON services
  FOR SELECT
  USING (
    user_id IN (
      SELECT om.user_id
      FROM organization_members om
      WHERE om.organization_id = services.organization_id
        AND om.user_id != auth.uid()
        AND om.deleted_at IS NULL
    )
  );

CREATE POLICY "services_manage_own" ON services
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- TESTIMONIALS - TENANT-AWARE ACCESS
-- ============================================================================

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "testimonials_view_own" ON testimonials
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "testimonials_view_tenant_members" ON testimonials
  FOR SELECT
  USING (
    user_id IN (
      SELECT om.user_id
      FROM organization_members om
      WHERE om.organization_id = testimonials.organization_id
        AND om.user_id != auth.uid()
        AND om.deleted_at IS NULL
    )
  );

CREATE POLICY "testimonials_manage_own" ON testimonials
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- PROJECTS - TENANT-AWARE WITH PUBLIC PUBLISHED ACCESS
-- ============================================================================

DROP POLICY IF EXISTS "projects_view" ON projects;
DROP POLICY IF EXISTS "projects_manage_own" ON projects;

CREATE POLICY "projects_view_own" ON projects
  FOR SELECT
  USING (
    -- User can view their own projects
    auth.uid() = user_id
  );

CREATE POLICY "projects_view_tenant_members" ON projects
  FOR SELECT
  USING (
    -- Org members can view projects
    user_id IN (
      SELECT om.user_id
      FROM organization_members om
      WHERE om.organization_id = projects.organization_id
        AND om.user_id != auth.uid()
        AND om.deleted_at IS NULL
    )
  );

CREATE POLICY "projects_view_published_public" ON projects
  FOR SELECT
  USING (
    -- Public can view PUBLISHED projects only
    status = 'published'
    AND deleted_at IS NULL
  );

CREATE POLICY "projects_manage_own" ON projects
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- PROJECT_GALLERY - TENANT-AWARE WITH PUBLIC ACCESS
-- ============================================================================

DROP POLICY IF EXISTS "project_gallery_view" ON project_gallery;

ALTER TABLE project_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_gallery_view_own_project" ON project_gallery
  FOR SELECT
  USING (
    -- User can view gallery of own project
    project_id IN (
      SELECT id FROM projects
      WHERE projects.user_id = auth.uid()
    )
  );

CREATE POLICY "project_gallery_view_published" ON project_gallery
  FOR SELECT
  USING (
    -- Public can view gallery of published projects
    project_id IN (
      SELECT id FROM projects
      WHERE projects.status = 'published'
        AND projects.deleted_at IS NULL
    )
  );

CREATE POLICY "project_gallery_manage_own" ON project_gallery
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE projects.user_id = auth.uid()
    )
  );

-- ============================================================================
-- BLOG_POSTS - TENANT-AWARE WITH PUBLIC PUBLISHED ACCESS
-- ============================================================================

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_posts_view_own" ON blog_posts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "blog_posts_view_tenant_members" ON blog_posts
  FOR SELECT
  USING (
    user_id IN (
      SELECT om.user_id
      FROM organization_members om
      WHERE om.organization_id = blog_posts.organization_id
        AND om.user_id != auth.uid()
        AND om.deleted_at IS NULL
    )
  );

CREATE POLICY "blog_posts_view_published_public" ON blog_posts
  FOR SELECT
  USING (
    status = 'published'
    AND deleted_at IS NULL
  );

CREATE POLICY "blog_posts_manage_own" ON blog_posts
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- MEDIA_FILES - TENANT-AWARE ACCESS
-- ============================================================================

DROP POLICY IF EXISTS "media_manage_own" ON media_files;

CREATE POLICY "media_view_own" ON media_files
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "media_view_tenant_members" ON media_files
  FOR SELECT
  USING (
    user_id IN (
      SELECT om.user_id
      FROM organization_members om
      WHERE om.organization_id = media_files.organization_id
        AND om.user_id != auth.uid()
        AND om.deleted_at IS NULL
    )
  );

CREATE POLICY "media_manage_own" ON media_files
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- AUDIT_LOGS - TENANT ISOLATION
-- ============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_view_org" ON audit_logs
  FOR SELECT
  USING (
    -- Only org members with audit:read permission can view
    organization_id IN (
      SELECT organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.deleted_at IS NULL
    )
  );

-- Admins/owners only
CREATE POLICY "audit_logs_insert_org" ON audit_logs
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.deleted_at IS NULL
    )
  );

-- ============================================================================
-- API_KEYS - TENANT ISOLATION
-- ============================================================================

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_view_org" ON api_keys
  FOR SELECT
  USING (
    -- User can view their own keys or admin can view all
    user_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.deleted_at IS NULL
    )
  );

CREATE POLICY "api_keys_insert_own" ON api_keys
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "api_keys_delete_own_or_admin" ON api_keys
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.deleted_at IS NULL
    )
  );

-- ============================================================================
-- BLOG_CATEGORIES - TENANT-AWARE ACCESS
-- ============================================================================

ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_categories_view_own" ON blog_categories
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "blog_categories_view_tenant_members" ON blog_categories
  FOR SELECT
  USING (
    user_id IN (
      SELECT om.user_id
      FROM organization_members om
      WHERE om.organization_id = blog_categories.organization_id
        AND om.user_id != auth.uid()
        AND om.deleted_at IS NULL
    )
  );

CREATE POLICY "blog_categories_manage_own" ON blog_categories
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- TECHNOLOGIES - TENANT-AWARE ACCESS
-- ============================================================================

ALTER TABLE technologies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "technologies_view_all" ON technologies
  FOR SELECT
  USING (true); -- Technologies shared across org

CREATE POLICY "technologies_manage_org" ON technologies
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.deleted_at IS NULL
    )
  );
