/**
 * AuthStore — single source of truth for the authentication & tenant context.
 *
 * Why a separate store?
 *   - Easier to test (state is a pure object)
 *   - Easier to swap to a different framework later (e.g. NgRx Signal Store)
 *   - Keeps the AuthService focused on HTTP + side-effects
 *
 * State is exposed as readonly signals. Mutations go through dedicated actions.
 */
import { Injectable, computed, signal } from '@angular/core';
import type {
  AuthUser,
  TenantSummary,
  MenuNode,
} from '@shared/models';
import { UserRole } from '@shared/models';

export interface AuthStoreState {
  // Identity
  user: AuthUser | null;

  // Active tenant (the one the user is currently acting as)
  tenant: TenantSummary | null;

  // All tenants the user can switch into
  availableTenants: TenantSummary[];

  // RBAC
  permissions: Set<string>;
  menu: MenuNode[];

  // Tokens
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  sessionId: string | null;

  // Lifecycle
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  errorCode: string | null;
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
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,
  errorCode: null,
};

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly state = signal<AuthStoreState>(initial);

  // --- Selectors (read-only signals) -----------------------------------------
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

  readonly isAuthenticated = computed(() => this.state().isAuthenticated);
  readonly isLoading = computed(() => this.state().isLoading);
  readonly isInitialized = computed(() => this.state().isInitialized);
  readonly error = computed(() => this.state().error);
  readonly errorCode = computed(() => this.state().errorCode);

  readonly role = computed<UserRole | null>(() => this.state().user?.role ?? null);
  readonly tenantId = computed<string | null>(() => this.state().tenant?.id ?? null);

  // --- Snapshot for non-reactive consumers -----------------------------------
  snapshot(): Readonly<AuthStoreState> {
    return this.state();
  }

  // --- Actions ---------------------------------------------------------------
  setLoading(isLoading: boolean): void {
    this.state.update((s) => ({ ...s, isLoading }));
  }

  setError(message: string | null, code: string | null = null): void {
    this.state.update((s) => ({ ...s, error: message, errorCode: code }));
  }

  markInitialized(): void {
    this.state.update((s) => ({ ...s, isInitialized: true }));
  }

  /** Set the full authenticated context after login / refresh / switch. */
  setSession(input: {
    user: AuthUser;
    tenant: TenantSummary;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: string;
    refreshTokenExpiresAt: string;
    sessionId: string;
    permissions?: string[];
    menu?: MenuNode[];
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
      permissions: new Set(input.permissions ?? []),
      menu: input.menu ?? [],
      isAuthenticated: true,
      isLoading: false,
      error: null,
      errorCode: null,
    }));
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

  setMeContext(input: {
    permissions: string[];
    menu: MenuNode[];
  }): void {
    this.state.update((s) => ({
      ...s,
      permissions: new Set(input.permissions),
      menu: input.menu,
    }));
  }

  setAvailableTenants(tenants: TenantSummary[]): void {
    this.state.update((s) => ({ ...s, availableTenants: tenants }));
  }

  /** Wipe all state (logout). */
  reset(): void {
    this.state.set({ ...initial, permissions: new Set() });
  }
}
