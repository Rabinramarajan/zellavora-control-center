-- =============================================================
-- 0005_rbac_core.sql
-- RBAC Core: permissions, permission_groups, roles, role_permissions
-- Depends on: 0004_enterprise_auth.sql (users, organizations, sessions)
-- =============================================================

-- ---------- Types ----------
DO $$ BEGIN
  CREATE TYPE permission_type AS ENUM ('feature','screen','component','action','database');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE permission_effect AS ENUM ('allow','deny');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE role_assignment_status AS ENUM ('active','suspended','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Permission Groups ----------
CREATE TABLE IF NOT EXISTS permission_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(100) UNIQUE NOT NULL,
  label       VARCHAR(200) NOT NULL,
  description TEXT,
  icon        VARCHAR(50),
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Permissions ----------
CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(200) UNIQUE NOT NULL,
  type        permission_type NOT NULL,
  label       VARCHAR(200) NOT NULL,
  description TEXT,
  group_id    UUID REFERENCES permission_groups(id) ON DELETE SET NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permissions_type  ON permissions(type);
CREATE INDEX IF NOT EXISTS idx_permissions_group ON permissions(group_id);
CREATE INDEX IF NOT EXISTS idx_permissions_key   ON permissions(key text_pattern_ops);

-- ---------- Roles ----------
CREATE TABLE IF NOT EXISTS roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  key             VARCHAR(100) NOT NULL,
  label           VARCHAR(200) NOT NULL,
  description     TEXT,
  level           INT NOT NULL DEFAULT 0,
  is_system       BOOLEAN NOT NULL DEFAULT false,
  color           VARCHAR(20),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_roles_org   ON roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_roles_level ON roles(level);

-- ---------- Role Permissions ----------
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id  UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  effect         permission_effect NOT NULL DEFAULT 'allow',
  conditions     JSONB NOT NULL DEFAULT '{}'::jsonb,
  granted_by     UUID REFERENCES users(id),
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_perms_perm ON role_permissions(permission_id);

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_permissions_updated ON permissions;
CREATE TRIGGER trg_permissions_updated
  BEFORE UPDATE ON permissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_roles_updated ON roles;
CREATE TRIGGER trg_roles_updated
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
