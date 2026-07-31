-- Reconcile schema drift: the 20260731000000_enterprise_registration migration
-- was recorded as applied but only partially executed. This migration replays
-- only the statements that never ran (all idempotent).

-- ============================================================================
-- OTP - add missing columns
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
-- AUDIT LOGS - add missing metadata columns
-- ============================================================================

ALTER TABLE "audit_logs"
ADD COLUMN IF NOT EXISTS "resource" VARCHAR,
ADD COLUMN IF NOT EXISTS "request_id" VARCHAR,
ADD COLUMN IF NOT EXISTS "metadata" JSONB,
ADD COLUMN IF NOT EXISTS "severity" VARCHAR DEFAULT 'info';

-- ============================================================================
-- DEPARTMENTS
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
-- WORKSPACES
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
-- ORGANIZATION SETTINGS
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
-- REFRESH TOKENS
-- ============================================================================

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "token" VARCHAR UNIQUE NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID,
    "organization_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "is_revoked" BOOLEAN DEFAULT false,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- ============================================================================
-- PASSWORD HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS "password_history" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "password_hash" VARCHAR NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "password_history_user_id_idx" ON "password_history"("user_id");

-- ============================================================================
-- EMAIL VERIFICATIONS
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
-- MOBILE VERIFICATIONS
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
-- PASSWORD RESETS
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
-- THEMES
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

INSERT INTO "themes" ("name", "primary_color", "mode", "is_default") VALUES
    ('Default Light', '#3B82F6', 'light', true),
    ('Default Dark', '#3B82F6', 'dark', false)
ON CONFLICT ("name") DO NOTHING;
