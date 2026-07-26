-- =============================================================
-- 0007_rbac_assignments.sql
-- User-role assignments, direct overrides, resource scopes
-- Depends on: 0005, 0006
-- =============================================================

-- ---------- User Role Assignments ----------
CREATE TABLE IF NOT EXISTS user_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type   VARCHAR(50),
  resource_id     UUID,
  status          role_assignment_status NOT NULL DEFAULT 'active',
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until     TIMESTAMPTZ,
  assigned_by     UUID REFERENCES users(id),
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID REFERENCES users(id),
  revoke_reason   TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user
  ON user_roles(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_user_roles_role
  ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_org
  ON user_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_resource
  ON user_roles(resource_type, resource_id) WHERE resource_id IS NOT NULL;

-- ---------- Direct User Permission Overrides ----------
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  effect          permission_effect NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type   VARCHAR(50),
  resource_id     UUID,
  valid_until     TIMESTAMPTZ,
  granted_by      UUID REFERENCES users(id),
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_id, organization_id)
);

-- ---------- Resource Scopes (Database-level permissions) ----------
CREATE TABLE IF NOT EXISTS resource_scopes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type   VARCHAR(50) NOT NULL,
  scope           VARCHAR(20) NOT NULL CHECK (scope IN ('own','team','department','all')),
  conditions      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id, resource_type)
);

CREATE INDEX IF NOT EXISTS idx_res_scopes_lookup
  ON resource_scopes(user_id, organization_id, resource_type);
