/**
 * PermissionService — the canonical "can I do X?" facade.
 *
 *   - can(key): returns a Signal<boolean> reactive to policy changes
 *   - canSync(key): imperative boolean for hot paths
 *   - canAll / canAny: array variants
 *   - hasRole: role-key check
 *   - hasAnyRole: any-of
 *   - refreshPolicy(): pull latest from /api/v1/rbac/me/policy
 *   - checkMany(keys): server bulk-check (used when client is unsure)
 */
import { Injectable, computed, inject, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PolicyStore } from '../store/policy.store';
import type { CheckResponse, CheckResult } from '../models/check.model';
import type { EffectivePolicy } from '../models/policy.model';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private http = inject(HttpClient);
  private store = inject(PolicyStore);

  // ---------- Reactive (Signal) ----------

  /**
   * Returns a Signal<boolean> that re-evaluates whenever the policy
   * changes. Use in templates: `@if (can('users:user:delete')()) { ... }`.
   */
  can(permission: string): Signal<boolean> {
    return computed(() => this.canSync(permission));
  }

  // ---------- Imperative (sync) ----------

  canSync(permission: string): boolean {
    const policy = this.store.policy();
    if (!policy) return false;
    if (policy.denied.includes(permission)) return false;
    if (policy.allowed.includes(permission)) return true;

    // Wildcard match (e.g. allowed has "users:*:create")
    for (const key of policy.allowed) {
      if (this.matchGlob(key, permission)) return true;
    }
    return false;
  }

  canAll(permissions: string[]): boolean {
    return permissions.every(p => this.canSync(p));
  }

  canAny(permissions: string[]): boolean {
    return permissions.some(p => this.canSync(p));
  }

  hasRole(roleKey: string): boolean {
    return this.store.roles().some(r => r.key === roleKey);
  }

  hasAnyRole(roleKeys: string[]): boolean {
    const assigned = new Set(this.store.roles().map(r => r.key));
    return roleKeys.some(k => assigned.has(k));
  }

  hasFeature(feature: string): boolean {
    return this.canSync(`feature:${feature}`);
  }

  maxRoleLevel(): number {
    return this.store.roles().reduce((m, r) => Math.max(m, r.level), 0);
  }

  // ---------- Server refresh ----------

  /**
   * Fetch /me/policy and update the store.
   * Call on login, tenant switch, and from the policy-version interceptor.
   */
  async refreshPolicy(): Promise<EffectivePolicy> {
    this.store.setLoading(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ data: EffectivePolicy }>('/api/v1/rbac/me/policy')
      );
      this.store.setPolicy(res.data);
      return res.data;
    } finally {
      this.store.setLoading(false);
    }
  }

  /**
   * Server-side bulk check. Use when the client policy is stale or
   * when the permission is conditional on a resource that the client
   * doesn't know about.
   */
  async checkMany(permissions: string[]): Promise<CheckResponse> {
    const res = await firstValueFrom(
      this.http.post<{ data: CheckResponse }>('/api/v1/rbac/check', { checks: permissions })
    );
    return res.data;
  }

  // ---------- Glob matcher ----------

  private globReCache = new Map<string, RegExp>();

  private matchGlob(pattern: string, key: string): boolean {
    if (!pattern.includes('*')) return false;
    let re = this.globReCache.get(pattern);
    if (!re) {
      const escaped = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^:]*');
      re = new RegExp('^' + escaped + '$');
      this.globReCache.set(pattern, re);
    }
    return re.test(key);
  }
}
