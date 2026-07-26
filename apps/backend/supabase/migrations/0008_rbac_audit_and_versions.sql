-- =============================================================
-- 0008_rbac_audit_and_versions.sql
-- Audit log (hash-chained) + policy version bump triggers
-- Depends on: 0005, 0006, 0007
-- =============================================================

-- ---------- Policy Versions ----------
CREATE TABLE IF NOT EXISTS policy_versions (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  version         BIGINT NOT NULL DEFAULT 1,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES users(id)
);

-- Bump helper
CREATE OR REPLACE FUNCTION bump_policy_version() RETURNS TRIGGER AS $$
DECLARE
  target_org UUID;
BEGIN
  target_org := COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id END,
    NEW.organization_id
  );

  -- Some tables (e.g. role_inheritance) need the role's org
  IF target_org IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      SELECT organization_id INTO target_org FROM roles WHERE id = OLD.role_id;
    ELSE
      SELECT organization_id INTO target_org FROM roles WHERE id = NEW.role_id;
    END IF;
  END IF;

  IF target_org IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO policy_versions (organization_id, version, updated_at)
  VALUES (target_org, 1, now())
  ON CONFLICT (organization_id) DO UPDATE
    SET version = policy_versions.version + 1, updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers on every policy-bearing table
DROP TRIGGER IF EXISTS trg_bump_v_role_perms      ON role_permissions;
DROP TRIGGER IF EXISTS trg_bump_v_user_roles      ON user_roles;
DROP TRIGGER IF EXISTS trg_bump_v_user_perms      ON user_permissions;
DROP TRIGGER IF EXISTS trg_bump_v_role_inh         ON role_inheritance;
DROP TRIGGER IF EXISTS trg_bump_v_roles            ON roles;
DROP TRIGGER IF EXISTS trg_bump_v_res_scopes       ON resource_scopes;

CREATE TRIGGER trg_bump_v_role_perms
  AFTER INSERT OR UPDATE OR DELETE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION bump_policy_version();

CREATE TRIGGER trg_bump_v_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION bump_policy_version();

CREATE TRIGGER trg_bump_v_user_perms
  AFTER INSERT OR UPDATE OR DELETE ON user_permissions
  FOR EACH ROW EXECUTE FUNCTION bump_policy_version();

CREATE TRIGGER trg_bump_v_role_inh
  AFTER INSERT OR UPDATE OR DELETE ON role_inheritance
  FOR EACH ROW EXECUTE FUNCTION bump_policy_version();

CREATE TRIGGER trg_bump_v_roles
  AFTER INSERT OR UPDATE OR DELETE ON roles
  FOR EACH ROW EXECUTE FUNCTION bump_policy_version();

CREATE TRIGGER trg_bump_v_res_scopes
  AFTER INSERT OR UPDATE OR DELETE ON resource_scopes
  FOR EACH ROW EXECUTE FUNCTION bump_policy_version();

-- ---------- Audit Log ----------
CREATE TABLE IF NOT EXISTS audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email     VARCHAR(200),
  action          VARCHAR(100) NOT NULL,
  resource_type   VARCHAR(50),
  resource_id     UUID,
  decision        VARCHAR(20),
  permission_key  VARCHAR(200),
  description     TEXT,
  old_values      JSONB,
  new_values      JSONB,
  context         JSONB NOT NULL DEFAULT '{}'::jsonb,
  prev_hash       CHAR(64),
  hash            CHAR(64) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_org_time  ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor    ON audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_perm     ON audit_logs(permission_key, created_at DESC);

-- Helper to write a chained entry (called by app via RPC).
-- Computes prev_hash by reading the latest entry in the org.
CREATE OR REPLACE FUNCTION append_audit_log(
  p_org_id        UUID,
  p_actor_id      UUID,
  p_actor_email   VARCHAR,
  p_action        VARCHAR,
  p_resource_type VARCHAR,
  p_resource_id   UUID,
  p_decision      VARCHAR,
  p_permission_key VARCHAR,
  p_description   TEXT,
  p_old_values    JSONB,
  p_new_values    JSONB,
  p_context       JSONB
) RETURNS BIGINT AS $$
DECLARE
  v_prev_hash CHAR(64);
  v_payload   TEXT;
  v_hash      CHAR(64);
  v_id        BIGINT;
BEGIN
  SELECT a.hash INTO v_prev_hash
  FROM audit_logs a
  WHERE a.organization_id = p_org_id
  ORDER BY a.id DESC
  LIMIT 1;

  v_payload := json_build_object(
    'org', p_org_id,
    'actor', p_actor_id,
    'action', p_action,
    'resource_type', p_resource_type,
    'resource_id', p_resource_id,
    'decision', p_decision,
    'permission', p_permission_key,
    'old', p_old_values,
    'new', p_new_values,
    'context', p_context,
    'prev', v_prev_hash
  )::text;

  v_hash := encode(digest(v_payload, 'sha256'), 'hex');

  INSERT INTO audit_logs (
    organization_id, actor_id, actor_email, action,
    resource_type, resource_id, decision, permission_key,
    description, old_values, new_values, context,
    prev_hash, hash
  ) VALUES (
    p_org_id, p_actor_id, p_actor_email, p_action,
    p_resource_type, p_resource_id, p_decision, p_permission_key,
    p_description, p_old_values, p_new_values, p_context,
    v_prev_hash, v_hash
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Make sure pgcrypto is available for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- RLS policies ----------
ALTER TABLE roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_scopes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;

-- Members of the same org can read roles/permissions (tenant isolation)
DROP POLICY IF EXISTS rbac_read_org_isolation ON roles;
CREATE POLICY rbac_read_org_isolation ON roles
  FOR SELECT
  USING (
    organization_id IS NULL  -- system roles
    OR organization_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

DROP POLICY IF EXISTS rbac_perms_read ON permissions;
CREATE POLICY rbac_perms_read ON permissions
  FOR SELECT USING (true);   -- permissions are global catalog

DROP POLICY IF EXISTS rbac_user_roles_read ON user_roles;
CREATE POLICY rbac_user_roles_read ON user_roles
  FOR SELECT
  USING (organization_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS rbac_audit_read ON audit_logs;
CREATE POLICY rbac_audit_read ON audit_logs
  FOR SELECT
  USING (organization_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Mutations are NOT allowed via RLS — must go through service role
-- (defense in depth, prevents direct API/PostgREST writes).
