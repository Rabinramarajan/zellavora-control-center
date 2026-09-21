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
import { AuthStore } from '@core/auth/auth.store';
import type { CheckResponse } from '../models/check.model';
import type { EffectivePolicy } from '../models/policy.model';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private http = inject(HttpClient);
  private store = inject(PolicyStore);
  private auth = inject(AuthStore);

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
    } catch {
      // The RBAC engine needs Redis and answers 503 where it is not
      // configured. Falling through with a null policy would fail every
      // check closed and hide the whole IAM section from an owner, so fall
      // back to the permission set /auth/me already returned.
      const fallback = this.policyFromSession();
      this.store.setPolicy(fallback);
      return fallback;
    } finally {
      this.store.setLoading(false);
    }
  }

  /** Policy built from the permissions the login response carried. */
  private policyFromSession(): EffectivePolicy {
    const session = this.auth.snapshot();
    return {
      userId: session.user?.id ?? '',
      orgId: session.tenant?.id ?? '',
      version: 0,
      allowed: [...session.permissions],
      denied: [],
      roles: [],
      resolvedAt: Date.now(),
    };
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

  /**
   * Glob match of a granted key against a requested one.
   *
   * An interior `*` covers one segment (`users:*:create`), but a trailing `*`
   * covers everything after it, so `users:*` grants `users:role:assign` and
   * `*:*` grants `system:audit:read`. This mirrors the server-side
   * PermissionService.has() that the menu and route guards rely on.
   */
  private matchGlob(pattern: string, key: string): boolean {
    if (!pattern.includes('*')) return false;
    let re = this.globReCache.get(pattern);
    if (!re) {
      const trailingWildcard = pattern.endsWith(':*');
      const body = trailingWildcard ? pattern.slice(0, -2) : pattern;
      const escaped = body
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^:]*');
      re = new RegExp('^' + escaped + (trailingWildcard ? '(?::.*)?' : '') + '$');
      this.globReCache.set(pattern, re);
    }
    return re.test(key);
  }
}
