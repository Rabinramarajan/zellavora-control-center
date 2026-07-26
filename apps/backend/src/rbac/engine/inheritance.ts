/**
 * DAG expansion utilities.
 *
 * Given a set of role IDs, returns the closure including all transitive
 * ancestors. Uses BFS with a visited set to handle DAGs (multiple parents)
 * and short-circuit on cycles.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface RoleNode {
  id: string;
  key: string;
  label: string;
  organization_id: string | null;
  level: number;
}

/**
 * Expand a seed set of role IDs into the full effective set, traversing
 * the role_inheritance table in BFS order.
 *
 * Cycle-safe: every visited ID is recorded; revisit = skip.
 * Depth-limited: max 8 hops, anything beyond is rejected.
 */
export async function expandRoleGraph(
  db: SupabaseClient,
  seedRoleIds: string[]
): Promise<RoleNode[]> {
  if (seedRoleIds.length === 0) return [];

  const visited = new Set<string>(seedRoleIds);
  const queue: Array<{ id: string; depth: number }> =
    seedRoleIds.map(id => ({ id, depth: 0 }));
  const collected: RoleNode[] = [];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth > 8) {
      throw new Error(`Role inheritance depth exceeds 8 starting from role ${id}`);
    }

    // Fetch role metadata
    const { data: role, error: roleErr } = await db
      .from('roles')
      .select('id, key, label, organization_id, level')
      .eq('id', id)
      .single();
    if (roleErr || !role) continue;
    collected.push(role as RoleNode);

    // Fetch parents
    const { data: parents, error: parErr } = await db
      .from('role_inheritance')
      .select('parent_role_id')
      .eq('role_id', id);
    if (parErr) continue;

    for (const p of parents ?? []) {
      if (!visited.has(p.parent_role_id)) {
        visited.add(p.parent_role_id);
        queue.push({ id: p.parent_role_id, depth: depth + 1 });
      }
    }
  }

  return collected;
}

/**
 * Detect whether adding `parentId` as parent of `roleId` would create a cycle.
 * Used by the service layer to fail-fast before hitting the DB trigger.
 */
export async function wouldCreateCycle(
  db: SupabaseClient,
  roleId: string,
  parentId: string
): Promise<boolean> {
  if (roleId === parentId) return true;

  const visited = new Set<string>();
  const queue: string[] = [parentId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (current === roleId) return true;

    const { data: parents } = await db
      .from('role_inheritance')
      .select('parent_role_id')
      .eq('role_id', current);
    for (const p of parents ?? []) queue.push(p.parent_role_id);
  }

  return false;
}
