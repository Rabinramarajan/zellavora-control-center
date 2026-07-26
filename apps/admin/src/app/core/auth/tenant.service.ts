/**
 * TenantService — current tenant context + tenant switching.
 *
 * Reads from AuthStore (which is hydrated by AuthService). Provides a small
 * surface for components: the current tenant, the list of available tenants,
 * and the switch action.
 */
import { Injectable, computed, inject } from '@angular/core';
import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';
import { TenantSummary } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly store = inject(AuthStore);
  private readonly auth = inject(AuthService);

  readonly current = computed<TenantSummary | null>(() => this.store.tenant());
  readonly available = computed<TenantSummary[]>(() => this.store.tenants());
  readonly currentId = computed<string | null>(() => this.store.tenantId());

  /** True if the current tenant enforces 2FA. */
  readonly requiresMfa = computed<boolean>(() => {
    const t = this.store.tenant() as (TenantSummary & { enforce2fa?: boolean }) | null;
    return !!t?.enforce2fa;
  });

  switchTo(organizationId: string) {
    return this.auth.switchTenant({ organizationId });
  }
}
