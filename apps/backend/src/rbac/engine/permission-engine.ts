/**
 * Permission Engine — core resolution + check logic.
 *
 * Responsibilities:
 *   - Resolve a user's effective permission set (DAG-expanded)
 *   - Answer single- and batch-permission checks
 *   - Apply DENY-wins rule across role and override layers
 *   - Drive cache via policy version
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { expandRoleGraph, RoleNode } from './inheritance';
import { matchesGlob } from './matcher';
import { PolicyCache } from '../cache/policy-cache';

export interface EffectivePolicy {
  userId: string;
  orgId: string;
  version: number;
  allowed: string[];
  denied: string[];
  roles: { id: string; key: string; label: string; level: number }[];
  resolvedAt: number;
  source: 'l1' | 'l2' | 'fresh';
}

export type CheckSource = 'role' | 'inherited' | 'override' | 'deny' | null;

export interface CheckResult {
  permission: string;
  allowed: boolean;
  source: CheckSource;
}

export class PermissionEngine {
  constructor(
    private db: SupabaseClient,
    private cache: PolicyCache
  ) {}

  /**
   * Fetch the current policy version for a tenant. Used as part of the
   * cache key so any policy change auto-invalidates.
   */
  async getPolicyVersion(orgId: string): Promise<number> {
    const { data, error } = await this.db
      .from('policy_versions')
      .select('version')
      .eq('organization_id', orgId)
      .single();
    if (error || !data) return 1;
    return data.version;
  }

  /**
   * Resolve the full effective policy for a user within an org.
   * Cache key includes the policy version, so mutations self-invalidate.
   */
  async resolve(userId: string, orgId: string): Promise<EffectivePolicy> {
    const version = await this.getPolicyVersion(orgId);
    const cached = await this.cache.get(userId, orgId, version);
    if (cached) return { ...cached, source: 'l1' };

    const fresh = await this.buildPolicy(userId, orgId, version);
    await this.cache.set(userId, orgId, version, fresh);
    return { ...fresh, source: 'fresh' };
  }

  /**
   * Build policy from DB (called by resolve and on cache miss).
   * Single-flight lock prevents stampede.
   */
  private async buildPolicy(
    userId: string,
    orgId: string,
    version: number
  ): Promise<EffectivePolicy> {
    return this.cache.setWithLock(userId, orgId, version, async () => {
      // 1. User's active role assignments
      const { data: assignments } = await this.db
        .from('user_roles')
        .select('role_id, resource_type, resource_id')
        .eq('user_id', userId)
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .lte('valid_from', new Date().toISOString())
        .or('valid_until.is.null,valid_until.gt.' + new Date().toISOString());

      const seedRoles = (assignments ?? []).map(a => a.role_id);
      if (seedRoles.length === 0) {
        return {
          userId, orgId, version,
          allowed: [],
          denied: [],
          roles: [],
          resolvedAt: Date.now(),
          source: 'fresh'
        };
      }

      // 2. DAG expansion
      const effectiveRoles: RoleNode[] = await expandRoleGraph(this.db, seedRoles);

      // 3. Role-level permissions
      const { data: rolePerms } = await this.db
        .from('role_permissions')
        .select('effect, permissions!inner(key)')
        .in('role_id', effectiveRoles.map(r => r.id));

      // 4. Direct user overrides
      const { data: userOverrides } = await this.db
        .from('user_permissions')
        .select('effect, permissions!inner(key)')
        .eq('user_id', userId)
        .eq('organization_id', orgId)
        .or('valid_until.is.null,valid_until.gt.' + new Date().toISOString());

      // 5. Resolve: DENY wins
      const allowed = new Set<string>();
      const denied  = new Set<string>();

      for (const rp of rolePerms ?? []) {
        const key = (rp as any).permissions?.key;
        if (!key) continue;
        (rp.effect === 'deny' ? denied : allowed).add(key);
      }
      for (const u of userOverrides ?? []) {
        const key = (u as any).permissions?.key;
        if (!key) continue;
        (u.effect === 'deny' ? denied : allowed).add(key);
      }
      for (const k of denied) allowed.delete(k);

      return {
        userId, orgId, version,
        allowed: [...allowed],
        denied: [...denied],
        roles: effectiveRoles.map(r => ({
          id: r.id, key: r.key, label: r.label, level: r.level
        })),
        resolvedAt: Date.now(),
        source: 'fresh'
      };
    });
  }

  /**
   * Single-permission check. Wildcard-aware.
   */
  async check(
    userId: string,
    orgId: string,
    permission: string
  ): Promise<{ allowed: boolean; source: CheckSource }> {
    const policy = await this.resolve(userId, orgId);

    if (policy.denied.includes(permission))  return { allowed: false, source: 'deny' };
    if (policy.allowed.includes(permission)) return { allowed: true,  source: 'role' };

    const inherited = policy.allowed.find(k => matchesGlob(k, permission));
    return { allowed: !!inherited, source: inherited ? 'inherited' : null };
  }

  /**
   * Batch check — single resolve, many answers. Used by /rbac/check endpoint.
   */
  async checkMany(
    userId: string,
    orgId: string,
    permissions: string[]
  ): Promise<{ results: CheckResult[]; version: number }> {
    const policy = await this.resolve(userId, orgId);
    const deniedSet = new Set(policy.denied);
    const allowedSet = new Set(policy.allowed);

    const results: CheckResult[] = permissions.map(p => {
      if (deniedSet.has(p))  return { permission: p, allowed: false, source: 'deny' };
      if (allowedSet.has(p)) return { permission: p, allowed: true,  source: 'role' };
      const inherited = policy.allowed.find(k => matchesGlob(k, p));
      return {
        permission: p,
        allowed: !!inherited,
        source: inherited ? 'inherited' : null
      };
    });

    return { results, version: policy.version };
  }

  /**
   * Force-invalidate this user's cached policy.
   * Called by mutation handlers (role/permission changes).
   */
  async invalidate(userId: string, orgId: string): Promise<void> {
    await this.cache.invalidate(userId, orgId);
  }

  /**
   * Invalidate entire org. Used on broad changes (e.g. role delete).
   */
  async invalidateOrg(orgId: string): Promise<void> {
    await this.cache.invalidateOrg(orgId);
  }
}
