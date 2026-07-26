/**
 * PermissionService — fine-grained permission checks.
 *
 * Source of truth is the AuthStore, which is hydrated by /auth/me. We also
 * expose role-based checks for the rare case where that's all you need.
 *
 * Wildcard support: `*:read` matches `projects:read`, `blog:read`, etc.
 */
import { Injectable, computed, inject } from '@angular/core';
import { AuthStore } from './auth.store';
import { UserRole } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly store = inject(AuthStore);

  readonly permissions = computed(() => this.store.permissions());
  readonly role = computed(() => this.store.role());

  has(code: string): boolean {
    const set = this.store.permissions();
    if (set.has(code)) return true;
    const action = code.split(':')[1];
    return !!action && set.has(`*:${action}`);
  }

  hasAny(...codes: string[]): boolean {
    return codes.some((c) => this.has(c));
  }

  hasAll(...codes: string[]): boolean {
    return codes.every((c) => this.has(c));
  }

  /** Role check (org-relative; same user can be owner in one tenant, member in another). */
  is(role: UserRole | UserRole[]): boolean {
    const current = this.role();
    if (!current) return false;
    return Array.isArray(role) ? role.includes(current) : current === role;
  }

  /** Structural directive helper. */
  has$(code: string) {
    return computed(() => this.has(code));
  }
}
