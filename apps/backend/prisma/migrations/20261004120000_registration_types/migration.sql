-- Registration types: how an account came into being, plus per-organization
-- self-registration configuration.

-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM (
  'ORGANIZATION_MEMBER',
  'INDIVIDUAL',
  'CREATE_ORGANIZATION',
  'PARTNER',
  'VENDOR',
  'CONTRACTOR'
);

-- AlterTable: users
-- Nullable on purpose. Existing accounts were created by an administrator or an
-- invitation, not by registering, and backfilling them with a registration type
-- would be a fabricated fact.
ALTER TABLE "users" ADD COLUMN "registration_type" "RegistrationType";

-- AlterTable: organizations
-- Default false: turning on the global ALLOW_SELF_REGISTRATION must not open
-- every existing tenant to public registration (see REGISTRATION_MODULE_REVIEW).
ALTER TABLE "organizations"
  ADD COLUMN "allow_self_registration"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowed_registration_types"  JSONB,
  ADD COLUMN "require_admin_approval"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "require_email_verification"  BOOLEAN NOT NULL DEFAULT true;

-- Registration looks organizations up by this flag on every public request.
CREATE INDEX "organizations_allow_self_registration_idx"
  ON "organizations" ("allow_self_registration")
  WHERE "allow_self_registration" = true;

-- AlterTable: audit_logs
-- An individual account belongs to no organization, so a platform-scope audit
-- row has no organization id. Every reader already treats the column as an
-- optional filter, so org-scoped queries are unaffected.
ALTER TABLE "audit_logs" ALTER COLUMN "organization_id" DROP NOT NULL;
