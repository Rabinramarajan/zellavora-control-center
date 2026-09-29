/**
 * PolicyStore — Angular signal-based store for the current user's
 * effective policy. Single source of truth for all permission checks
 * in the UI.
 *
 * Components/services can react to policy changes via signals + effects.
 */
import { Injectable, computed, signal } from '@angular/core';
import type { EffectivePolicy } from '../models/policy.model';

@Injectable({ providedIn: 'root' })
export class PolicyStore {
  private readonly _policy = signal<EffectivePolicy | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _lastRefresh = signal<number>(0);

  readonly policy = this._policy.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly lastRefresh = this._lastRefresh.asReadonly();

  /** Allowed permission keys as a Set — O(1) lookup in directives. */
  readonly allowedSet = computed<Set<string>>(
    () => new Set(this._policy()?.allowed ?? [])
  );

  /** Denied permission keys as a Set. */
  readonly deniedSet = computed<Set<string>>(
    () => new Set(this._policy()?.denied ?? [])
  );

  /** Current policy version. Bumps invalidate cached UI decisions. */
  readonly version = computed<number>(() => this._policy()?.version ?? 0);

  /** True if any policy is loaded. */
  readonly hasPolicy = computed<boolean>(() => this._policy() !== null);

  /** Roles assigned to the current user. */
  readonly roles = computed(() => this._policy()?.roles ?? []);

  setPolicy(p: EffectivePolicy): void {
    this._policy.set(p);
    this._lastRefresh.set(Date.now());
  }

  setLoading(v: boolean): void {
    this._loading.set(v);
  }

  clear(): void {
    this._policy.set(null);
    this._lastRefresh.set(0);
  }
}
