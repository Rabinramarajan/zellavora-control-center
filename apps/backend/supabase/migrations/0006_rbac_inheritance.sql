-- =============================================================
-- 0006_rbac_inheritance.sql
-- DAG-based role inheritance with cycle detection (max depth 8)
-- Depends on: 0005_rbac_core.sql
-- =============================================================

CREATE TABLE IF NOT EXISTS role_inheritance (
  role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  parent_role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, parent_role_id),
  CHECK (role_id <> parent_role_id)
);

CREATE INDEX IF NOT EXISTS idx_role_inh_parent ON role_inheritance(parent_role_id);

-- ---------- Cycle detection ----------
CREATE OR REPLACE FUNCTION check_role_inheritance_cycle()
RETURNS TRIGGER AS $$
DECLARE
  cycle_found BOOLEAN;
BEGIN
  -- Walk from new parent upward; if we ever reach NEW.role_id, there's a cycle.
  WITH RECURSIVE chain(id) AS (
    SELECT NEW.parent_role_id
    UNION ALL
    SELECT ri.parent_role_id
    FROM role_inheritance ri
    JOIN chain c ON ri.role_id = c.id
  )
  SELECT EXISTS (SELECT 1 FROM chain WHERE id = NEW.role_id) INTO cycle_found;

  IF cycle_found THEN
    RAISE EXCEPTION 'Role inheritance cycle detected: % -> %', NEW.parent_role_id, NEW.role_id;
  END IF;

  -- Depth check: chain length must be <= 8
  IF (
    WITH RECURSIVE chain(id, depth) AS (
      SELECT NEW.parent_role_id, 1
      UNION ALL
      SELECT ri.parent_role_id, c.depth + 1
      FROM role_inheritance ri
      JOIN chain c ON ri.role_id = c.id
      WHERE c.depth < 16   -- safety bound for recursion
    )
    SELECT max(depth) FROM chain
  ) > 8 THEN
    RAISE EXCEPTION 'Role inheritance depth exceeds 8 levels';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_role_inheritance_cycle ON role_inheritance;
CREATE TRIGGER trg_role_inheritance_cycle
  BEFORE INSERT OR UPDATE ON role_inheritance
  FOR EACH ROW EXECUTE FUNCTION check_role_inheritance_cycle();

-- ---------- DAG expansion helper ----------
-- Returns all role IDs transitively reachable from the given set
-- (including the inputs themselves).
CREATE OR REPLACE FUNCTION expand_role_graph(seed_ids UUID[])
RETURNS TABLE(id UUID)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE walk(root_id, current_id) AS (
    SELECT s, s FROM unnest(seed_ids) AS s
    UNION
    SELECT w.root_id, ri.parent_role_id
    FROM role_inheritance ri
    JOIN walk w ON ri.role_id = w.current_id
  )
  SELECT DISTINCT current_id FROM walk;
$$;
