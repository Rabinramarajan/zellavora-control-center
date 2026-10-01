/**
 * AuthStore — single source of truth for the authentication & tenant context.
 *
 * State is exposed as readonly signals; mutations go through dedicated actions.
 * Form-level loading and error state lives in the components that own the form.
 */
import { Injectable, computed, signal } from '@angular/core';
import type { AuthUser, MenuNode, TenantSummary } from '../../shared/models';
import { UserRole } from '../../shared/models';

export interface AuthStoreState {
  user: AuthUser | null;
  tenant: TenantSummary | null;
  availableTenants: TenantSummary[];
  permissions: Set<string>;
  menu: MenuNode[];
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  sessionId: string | null;
  /** Organization policy requires 2FA and the user hasn't enrolled yet. */
  mfaSetupRequired: boolean;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

const initial: AuthStoreState = {
  user: null,
  tenant: null,
  availableTenants: [],
  permissions: new Set<string>(),
  menu: [],
  accessToken: null,
  refreshToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  sessionId: null,
  mfaSetupRequired: false,
  isAuthenticated: false,
  isInitialized: false,
};

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly state = signal<AuthStoreState>(initial);

  readonly user = computed(() => this.state().user);
  readonly tenant = computed(() => this.state().tenant);
  readonly tenants = computed(() => this.state().availableTenants);
  readonly permissions = computed(() => this.state().permissions);
  readonly menu = computed(() => this.state().menu);
  readonly accessToken = computed(() => this.state().accessToken);
  readonly refreshToken = computed(() => this.state().refreshToken);
  readonly accessTokenExpiresAt = computed(() => this.state().accessTokenExpiresAt);
  readonly refreshTokenExpiresAt = computed(() => this.state().refreshTokenExpiresAt);
  readonly sessionId = computed(() => this.state().sessionId);
  readonly mfaSetupRequired = computed(() => this.state().mfaSetupRequired);
  readonly isAuthenticated = computed(() => this.state().isAuthenticated);
  readonly isInitialized = computed(() => this.state().isInitialized);

  readonly role = computed<UserRole | null>(() => this.state().user?.role ?? null);
  readonly tenantId = computed<string | null>(() => this.state().tenant?.id ?? null);

  snapshot(): Readonly<AuthStoreState> {
    return this.state();
  }

  markInitialized(): void {
    this.state.update((s) => ({ ...s, isInitialized: true }));
  }

  /** Set the full authenticated context after sign-in. */
  setSession(input: {
    user: AuthUser;
    tenant: TenantSummary;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string;
    sessionId: string;
  }): void {
    this.state.update((s) => ({
      ...s,
      user: input.user,
      tenant: input.tenant,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      accessTokenExpiresAt: new Date(input.accessTokenExpiresAt),
      refreshTokenExpiresAt: new Date(input.refreshTokenExpiresAt),
      sessionId: input.sessionId,
      permissions: new Set<string>(),
      menu: [],
      isAuthenticated: true,
    }));
  }

  /** Apply the /auth/me payload: identity, permissions and the server-filtered menu. */
  setProfile(input: {
    user: AuthUser;
    tenant: TenantSummary;
    permissions: string[];
    menu: MenuNode[];
    mfaSetupRequired: boolean;
  }): void {
    this.state.update((s) => ({
      ...s,
      user: input.user,
      tenant: input.tenant,
      permissions: new Set(input.permissions),
      menu: input.menu,
      mfaSetupRequired: input.mfaSetupRequired,
      isAuthenticated: true,
    }));
  }

  setMfaSetupRequired(required: boolean): void {
    this.state.update((s) => ({ ...s, mfaSetupRequired: required }));
  }

  /** Merge profile changes (e.g. a new avatar) into the signed-in user. */
  patchUser(changes: Partial<AuthUser>): void {
    this.state.update((s) => (s.user ? { ...s, user: { ...s.user, ...changes } } : s));
  }

  /** Update only tokens (after a refresh). */
  updateTokens(input: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string;
    sessionId: string;
  }): void {
    this.state.update((s) => ({
      ...s,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      accessTokenExpiresAt: new Date(input.accessTokenExpiresAt),
      refreshTokenExpiresAt: new Date(input.refreshTokenExpiresAt),
      sessionId: input.sessionId,
    }));
  }

  setAvailableTenants(tenants: TenantSummary[]): void {
    this.state.update((s) => ({ ...s, availableTenants: tenants }));
  }

  /** Wipe all state (sign-out / session expiry). */
  reset(): void {
    this.state.set({ ...initial, permissions: new Set() });
  }
}
