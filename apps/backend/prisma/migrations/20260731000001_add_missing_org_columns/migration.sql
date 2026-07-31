-- Add missing columns to organizations table
-- This migration adds all enterprise registration fields that are in the Prisma schema but missing from the database

-- ============================================================================
-- ADD MISSING COLUMNS TO ORGANIZATIONS TABLE
-- ============================================================================

ALTER TABLE "organizations" 
ADD COLUMN IF NOT EXISTS "legal_name" VARCHAR,
ADD COLUMN IF NOT EXISTS "favicon_url" VARCHAR,
ADD COLUMN IF NOT EXISTS "industry" VARCHAR,
ADD COLUMN IF NOT EXISTS "size" VARCHAR,
ADD COLUMN IF NOT EXISTS "website" VARCHAR,
ADD COLUMN IF NOT EXISTS "gst_number" VARCHAR,
ADD COLUMN IF NOT EXISTS "tax_number" VARCHAR,
ADD COLUMN IF NOT EXISTS "registration_number" VARCHAR,
ADD COLUMN IF NOT EXISTS "email" VARCHAR,
ADD COLUMN IF NOT EXISTS "phone" VARCHAR,
ADD COLUMN IF NOT EXISTS "address" VARCHAR,
ADD COLUMN IF NOT EXISTS "city" VARCHAR,
ADD COLUMN IF NOT EXISTS "state" VARCHAR,
ADD COLUMN IF NOT EXISTS "country" VARCHAR,
ADD COLUMN IF NOT EXISTS "pincode" VARCHAR,
ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "registration_source" VARCHAR,
ADD COLUMN IF NOT EXISTS "invite_code" VARCHAR,
ADD COLUMN IF NOT EXISTS "use_cases" JSONB,
ADD COLUMN IF NOT EXISTS "primary_color" VARCHAR,
ADD COLUMN IF NOT EXISTS "theme" VARCHAR DEFAULT 'light',
ADD COLUMN IF NOT EXISTS "terms_accepted" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "privacy_accepted" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "privacy_accepted_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "cookie_accepted" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "cookie_accepted_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "marketing_consent" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "marketing_consent_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ;

-- ============================================================================
-- ADD MISSING COLUMNS TO USERS TABLE
-- ============================================================================

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "first_name" VARCHAR,
ADD COLUMN IF NOT EXISTS "last_name" VARCHAR,
ADD COLUMN IF NOT EXISTS "display_name" VARCHAR,
ADD COLUMN IF NOT EXISTS "mobile" VARCHAR,
ADD COLUMN IF NOT EXISTS "mobile_verified" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "timezone" VARCHAR,
ADD COLUMN IF NOT EXISTS "language" VARCHAR DEFAULT 'en',
ADD COLUMN IF NOT EXISTS "password_changed_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "mfa_method" VARCHAR,
ADD COLUMN IF NOT EXISTS "mfa_secret" VARCHAR,
ADD COLUMN IF NOT EXISTS "recovery_codes" JSONB,
ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "terms_accepted" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "privacy_accepted" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "privacy_accepted_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "security_alerts" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "marketing_emails" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ;

-- ============================================================================
-- ENSURE ORGANIZATION_MEMBERS TABLE HAS CORRECT COLUMNS
-- ============================================================================

-- The table should already be named organization_members (not user_tenants)
-- Add missing columns if they don't exist
ALTER TABLE "organization_members"
ADD COLUMN IF NOT EXISTS "department_id" UUID,
ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "joined_at" TIMESTAMPTZ DEFAULT NOW();

-- Add foreign key for department_id if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'organization_members_department_id_fkey'
        AND table_name = 'organization_members'
    ) THEN
        ALTER TABLE "organization_members" 
        ADD CONSTRAINT "organization_members_department_id_fkey" 
        FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- ENSURE BRANCHES TABLE HAS CORRECT COLUMNS
-- ============================================================================

ALTER TABLE "branches"
ADD COLUMN IF NOT EXISTS "is_head_office" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "country" VARCHAR,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ;

-- ============================================================================
-- CREATE DEPARTMENTS TABLE IF NOT EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS "departments" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "name" VARCHAR NOT NULL,
    "code" VARCHAR,
    "description" VARCHAR,
    "parent_id" UUID REFERENCES "departments"("id") ON DELETE SET NULL,
    "status" VARCHAR DEFAULT 'active',
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "departments_organization_id_idx" ON "departments"("organization_id");

-- ============================================================================
-- CREATE WORKSPACES TABLE IF NOT EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS "workspaces" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "name" VARCHAR NOT NULL,
    "slug" VARCHAR NOT NULL,
    "description" VARCHAR,
    "settings" JSONB,
    "is_deleted" BOOLEAN DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "version" INTEGER DEFAULT 1,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_org_slug_unique" ON "workspaces"("organization_id", "slug");
CREATE INDEX IF NOT EXISTS "workspaces_organization_id_idx" ON "workspaces"("organization_id");

-- ============================================================================
-- CREATE ORGANIZATION_SETTINGS TABLE IF NOT EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS "organization_settings" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "key" VARCHAR NOT NULL,
    "value" VARCHAR NOT NULL,
    "category" VARCHAR,
    "is_encrypted" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS "org_settings_org_key_unique" ON "organization_settings"("organization_id", "key");
CREATE INDEX IF NOT EXISTS "org_settings_organization_id_idx" ON "organization_settings"("organization_id");

-- ============================================================================
-- CREATE SESSIONS TABLE IF NOT EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sessions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "refresh_token" VARCHAR UNIQUE,
    "ip_address" VARCHAR,
    "user_agent" VARCHAR,
    "device_info" JSONB,
    "is_active" BOOLEAN DEFAULT true,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "last_activity_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX IF NOT EXISTS "sessions_organization_id_idx" ON "sessions"("organization_id");
CREATE INDEX IF NOT EXISTS "sessions_refresh_token_idx" ON "sessions"("refresh_token");

-- ============================================================================
-- CREATE REFRESH_TOKENS TABLE IF NOT EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "token" VARCHAR UNIQUE NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID,
    "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "is_revoked" BOOLEAN DEFAULT false,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- ============================================================================
-- CREATE PASSWORD_HISTORY TABLE IF NOT EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS "password_history" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "password_hash" VARCHAR NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "password_history_user_id_idx" ON "password_history"("user_id");

-- ============================================================================
-- CREATE EMAIL_VERIFICATIONS TABLE IF NOT EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS "email_verifications" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" VARCHAR NOT NULL,
    "token" VARCHAR UNIQUE NOT NULL,
    "user_id" UUID,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "verified" BOOLEAN DEFAULT false,
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "email_verifications_email_idx" ON "email_verifications"("email");
CREATE INDEX IF NOT EXISTS "email_verifications_token_idx" ON "email_verifications"("token");

-- ============================================================================
-- CREATE MOBILE_VERIFICATIONS TABLE IF NOT EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS "mobile_verifications" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "mobile" VARCHAR UNIQUE NOT NULL,
    "country_code" VARCHAR NOT NULL,
    "otp_hash" VARCHAR NOT NULL,
    "user_id" UUID,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "verified" BOOLEAN DEFAULT false,
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "mobile_verifications_user_id_idx" ON "mobile_verifications"("user_id");

-- ============================================================================
-- CREATE PASSWORD_RESETS TABLE IF NOT EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS "password_resets" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" VARCHAR NOT NULL,
    "token" VARCHAR UNIQUE NOT NULL,
    "user_id" UUID,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "used" BOOLEAN DEFAULT false,
    "ip_address" VARCHAR,
    "user_agent" VARCHAR,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "password_resets_email_idx" ON "password_resets"("email");
CREATE INDEX IF NOT EXISTS "password_resets_token_idx" ON "password_resets"("token");

-- ============================================================================
-- CREATE REGISTRATION_SESSIONS TABLE IF NOT EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS "registration_sessions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" VARCHAR NOT NULL,
    "email_verified" BOOLEAN DEFAULT false,
    "mobile" VARCHAR,
    "mobile_verified" BOOLEAN DEFAULT false,
    "first_name" VARCHAR,
    "last_name" VARCHAR,
    "display_name" VARCHAR,
    "country" VARCHAR,
    "timezone" VARCHAR,
    "language" VARCHAR,
    "organization_name" VARCHAR,
    "organization_code" VARCHAR,
    "industry" VARCHAR,
    "size" VARCHAR,
    "website" VARCHAR,
    "gst_number" VARCHAR,
    "tax_number" VARCHAR,
    "logo_url" VARCHAR,
    "use_cases" JSONB,
    "branch_name" VARCHAR,
    "branch_code" VARCHAR,
    "branch_address" VARCHAR,
    "branch_city" VARCHAR,
    "branch_state" VARCHAR,
    "branch_country" VARCHAR,
    "branch_pincode" VARCHAR,
    "password_hash" VARCHAR,
    "mfa_enabled" BOOLEAN DEFAULT false,
    "mfa_method" VARCHAR,
    "mfa_secret" VARCHAR,
    "terms_accepted" BOOLEAN DEFAULT false,
    "privacy_accepted" BOOLEAN DEFAULT false,
    "cookie_accepted" BOOLEAN DEFAULT false,
    "marketing_consent" BOOLEAN DEFAULT false,
    "status" VARCHAR DEFAULT 'in_progress',
    "current_step" INTEGER DEFAULT 1,
    "ip_address" VARCHAR,
    "user_agent" VARCHAR,
    "expires_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "registration_sessions_email_idx" ON "registration_sessions"("email");
CREATE INDEX IF NOT EXISTS "registration_sessions_status_idx" ON "registration_sessions"("status");

-- ============================================================================
-- UPDATE INVITATIONS TABLE
-- ============================================================================

ALTER TABLE "invitations"
ADD COLUMN IF NOT EXISTS "organization_id" UUID REFERENCES "organizations"("id") ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS "role" VARCHAR DEFAULT 'employee',
ADD COLUMN IF NOT EXISTS "department_id" UUID,
ADD COLUMN IF NOT EXISTS "invited_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "status" VARCHAR DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ NOT NULL,
ADD COLUMN IF NOT EXISTS "used_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "created_by" UUID,
ADD COLUMN IF NOT EXISTS "updated_by" UUID,
ADD COLUMN IF NOT EXISTS "deleted_by" UUID,
ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "invitations_organization_id_idx" ON "invitations"("organization_id");

-- ============================================================================
-- UPDATE OTP TABLE
-- ============================================================================

ALTER TABLE "otps"
ADD COLUMN IF NOT EXISTS "attempts" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "max_attempts" INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR,
ADD COLUMN IF NOT EXISTS "user_agent" VARCHAR,
ADD COLUMN IF NOT EXISTS "user_id" UUID,
ADD COLUMN IF NOT EXISTS "session_id" VARCHAR;

CREATE INDEX IF NOT EXISTS "otps_user_id_idx" ON "otps"("user_id");

-- ============================================================================
-- PERMISSION GROUPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS "permission_groups" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR UNIQUE NOT NULL,
    "description" VARCHAR,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Add group_id to permissions if not exists
ALTER TABLE "permissions"
ADD COLUMN IF NOT EXISTS "group_id" UUID REFERENCES "permission_groups"("id") ON DELETE SET NULL;

-- ============================================================================
-- UPDATE ROLES TABLE
-- ============================================================================

ALTER TABLE "roles"
ADD COLUMN IF NOT EXISTS "name" VARCHAR,
ADD COLUMN IF NOT EXISTS "is_system" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ;

-- ============================================================================
-- CREATE THEMES TABLE IF NOT EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS "themes" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR UNIQUE NOT NULL,
    "primary_color" VARCHAR,
    "secondary_color" VARCHAR,
    "accent_color" VARCHAR,
    "background_color" VARCHAR,
    "text_color" VARCHAR,
    "mode" VARCHAR DEFAULT 'light',
    "is_default" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ
);

-- ============================================================================
-- UPDATE AUDIT_LOGS TABLE
-- ============================================================================

ALTER TABLE "audit_logs"
ADD COLUMN IF NOT EXISTS "resource" VARCHAR,
ADD COLUMN IF NOT EXISTS "resource_id" VARCHAR,
ADD COLUMN IF NOT EXISTS "request_id" VARCHAR,
ADD COLUMN IF NOT EXISTS "metadata" JSONB,
ADD COLUMN IF NOT EXISTS "severity" VARCHAR DEFAULT 'info';

-- ============================================================================
-- INSERT DEFAULT SYSTEM ROLES
-- ============================================================================

INSERT INTO "roles" ("id", "name", "key", "is_system", "created_at") VALUES
    (gen_random_uuid(), 'Organization Owner', 'owner', true, NOW()),
    (gen_random_uuid(), 'Administrator', 'admin', true, NOW()),
    (gen_random_uuid(), 'Manager', 'manager', true, NOW()),
    (gen_random_uuid(), 'Employee', 'employee', true, NOW()),
    (gen_random_uuid(), 'Viewer', 'viewer', true, NOW())
ON CONFLICT ("key") DO NOTHING;

-- ============================================================================
-- INSERT DEFAULT THEMES
-- ============================================================================

INSERT INTO "themes" ("name", "primary_color", "mode", "is_default") VALUES
    ('Default Light', '#3B82F6', 'light', true),
    ('Default Dark', '#3B82F6', 'dark', false)
ON CONFLICT ("name") DO NOTHING;

-- ============================================================================
-- UPDATE TRIGGER FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables with updated_at
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['organizations', 'users', 'branches', 'departments', 'workspaces', 'organization_settings', 'sessions', 'invitations', 'roles', 'themes']
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %I', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END;
$$;