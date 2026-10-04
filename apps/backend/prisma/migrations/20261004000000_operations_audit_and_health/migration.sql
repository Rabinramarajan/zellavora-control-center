-- Operations Module: Extend audit_logs table for comprehensive enterprise audit capture and indexing
ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "audit_id" TEXT,
  ADD COLUMN IF NOT EXISTS "module" TEXT,
  ADD COLUMN IF NOT EXISTS "resource_type" TEXT,
  ADD COLUMN IF NOT EXISTS "resource_name" TEXT,
  ADD COLUMN IF NOT EXISTS "http_method" TEXT,
  ADD COLUMN IF NOT EXISTS "endpoint" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN IF NOT EXISTS "correlation_id" TEXT,
  ADD COLUMN IF NOT EXISTS "before_data" JSONB,
  ADD COLUMN IF NOT EXISTS "after_data" JSONB,
  ADD COLUMN IF NOT EXISTS "error_code" TEXT,
  ADD COLUMN IF NOT EXISTS "error_message" TEXT;

-- Create unique index on audit_id
CREATE UNIQUE INDEX IF NOT EXISTS "audit_logs_audit_id_key" ON "audit_logs"("audit_id");

-- Performance indexes for querying audit trail
CREATE INDEX IF NOT EXISTS "audit_logs_module_idx" ON "audit_logs"("module");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_type_idx" ON "audit_logs"("resource_type");
CREATE INDEX IF NOT EXISTS "audit_logs_status_idx" ON "audit_logs"("status");
CREATE INDEX IF NOT EXISTS "audit_logs_correlation_id_idx" ON "audit_logs"("correlation_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- Permissions for Operations & Audit
INSERT INTO "permissions" ("id", "name", "key", "resource", "action", "description")
VALUES
  (gen_random_uuid(), 'view:operations:health', 'OPERATIONS_SYSTEM_HEALTH_VIEW', 'operations', 'system_health:view', 'View system operational availability and health check metrics'),
  (gen_random_uuid(), 'view:audit_logs',          'AUDIT_LOG_VIEW',               'operations', 'audit_logs:view',         'View administrative and security audit trail records'),
  (gen_random_uuid(), 'export:audit_logs',        'AUDIT_LOG_EXPORT',             'operations', 'audit_logs:export',       'Export audit trail records to CSV/Excel format')
ON CONFLICT ("key") DO NOTHING;

-- Grant permissions to Super Admin, Admin, and Operations roles
INSERT INTO "role_permissions" ("id", "organization_id", "role_id", "permission_id", "effect")
SELECT gen_random_uuid(), r."organization_id", r."id", p."id", 'allow'
FROM "roles" r
JOIN "permissions" p ON p."key" IN ('OPERATIONS_SYSTEM_HEALTH_VIEW', 'AUDIT_LOG_VIEW', 'AUDIT_LOG_EXPORT')
WHERE r."name" IN ('Super Admin', 'Admin', 'Owner', 'Operations User', 'Auditor')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
