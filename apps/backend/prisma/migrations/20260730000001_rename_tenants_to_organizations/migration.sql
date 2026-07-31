-- Rename tenants table to organizations
-- This migration must run AFTER 20260730000000_init_multi_tenant
-- and BEFORE 20260731000000_enterprise_registration

-- ============================================================================
-- RENAME TABLE: tenants -> organizations
-- ============================================================================

ALTER TABLE "tenants" RENAME TO "organizations";

-- ============================================================================
-- RENAME INDEXES
-- ============================================================================

ALTER INDEX "tenants_client_code_key" RENAME TO "organizations_client_code_key";
ALTER INDEX "tenants_pkey" RENAME TO "organizations_pkey";

-- ============================================================================
-- UPDATE FOREIGN KEY REFERENCES IN OTHER TABLES
-- ============================================================================

-- user_tenants table (organization_members)
ALTER TABLE "user_tenants" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER INDEX "user_tenants_tenant_id_idx" RENAME TO "user_tenants_organization_id_idx";

-- Drop and recreate foreign key with new column name
ALTER TABLE "user_tenants" DROP CONSTRAINT IF EXISTS "user_tenants_tenant_id_fkey";
ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- branches table
ALTER TABLE "branches" RENAME COLUMN "organization_id" TO "organization_id"; -- already correct name but references old table
ALTER INDEX "branches_organization_id_idx" RENAME TO "branches_organization_id_idx"; -- same name

-- Drop and recreate foreign key
ALTER TABLE "branches" DROP CONSTRAINT IF EXISTS "branches_organization_id_fkey";
ALTER TABLE "branches" ADD CONSTRAINT "branches_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- audit_logs table
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_organization_id_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- notifications table
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_organization_id_fkey";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- common_configurations table
ALTER TABLE "common_configurations" DROP CONSTRAINT IF EXISTS "common_configurations_organization_id_fkey";
ALTER TABLE "common_configurations" ADD CONSTRAINT "common_configurations_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- roles table (has organization_id)
ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "roles_organization_id_fkey";
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- user_role_assignments table
ALTER TABLE "user_role_assignments" DROP CONSTRAINT IF EXISTS "user_role_assignments_organization_id_fkey";
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- RENAME user_tenants TABLE TO organization_members (to match Prisma schema)
-- ============================================================================

ALTER TABLE "user_tenants" RENAME TO "organization_members";
ALTER INDEX "user_tenants_pkey" RENAME TO "organization_members_pkey";
ALTER INDEX "user_tenants_user_id_idx" RENAME TO "organization_members_user_id_idx"; -- if exists
ALTER INDEX "organization_members_organization_id_idx" RENAME TO "organization_members_organization_id_idx"; -- rename after table rename