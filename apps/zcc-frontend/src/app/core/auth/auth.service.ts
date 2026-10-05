/**
 * AuthService — authentication operations and session lifecycle.
 *
 * Storage strategy:
 *   - refresh token: localStorage when "keep me signed in", otherwise sessionStorage
 *   - access token + expiry: sessionStorage, reused across reloads until near expiry
 *   - pending 2FA challenge: sessionStorage, cleared on completion or cancel
 *
 * On app boot:
 *   1. Reuse the stored access token, or silently refresh when near expiry
 *   2. On success, hydrate the store from /auth/me (permissions + menu)
 *   3. On failure, clear local state; route guards send the user to sign in
 *
 * Route guards and hidden buttons are UX only — the API authorizes every call.
 */
import { DestroyRef, Injectable, effect, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, Subscription, of, throwError, timer } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap, tap } from 'rxjs/operators';

import { AuthStore } from './auth.store';
import { PolicyStore } from '../rbac/store/policy.store';
import { apiErrorCode } from './auth-errors';
import { AesService } from '../services/aes/aes.service';
import type {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
  ActiveSession,
  AuthConfig,
  ChangePasswordRequest,
  ChangePasswordResponse,
  GenericMessageResponse,
  InvitationPreview,
  LoginRequest,
  LoginResponse,
  LoginSuccessResponse,
  MeResponse,
  MfaChallengeResponse,
  MfaEnrollConfirmResponse,
  MfaEnrollStartResponse,
  MfaRecoveryCodesResponse,
  PendingMfaChallenge,
  RefreshResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  SecurityOverview,
  TenantSummary,
  VerifyEmailResponse,
} from '../../shared/models';

const STORAGE = {
  refresh: 'zcc.refresh',
  tokens: 'zcc.tokens',
  redirect: 'zcc.redirect',
  mfaChallenge: 'zcc.mfaChallenge',
  pendingEmail: 'zcc.pendingEmail',
  clientCode: 'zcc.clientCode',
  lowRecoveryCodes: 'zcc.lowRecoveryCodes',
} as const;

const AUTH_API = '/api/v1/auth';
/** Everyone, including INDIVIDUAL accounts, signs in to this organization by default. */
const DEFAULT_CLIENT_CODE = 'zellavora-inc';
const LOW_RECOVERY_CODE_THRESHOLD = 3;

/** Only same-app, non-auth paths may be restored after sign-in (no open redirects). */
function safeRedirect(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/auth/')) return null;
  return url;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly store = inject(AuthStore);
  private readonly policy = inject(PolicyStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly aes = inject(AesService);

  private refreshTimer: Subscription | null = null;
  private refreshRequest$?: Observable<boolean>;
  private config$?: Observable<AuthConfig>;
  private clients$?: Observable<TenantSummary[]>;
  private registrationOrgs$?: Observable<TenantSummary[]>;
  private refreshStorage: Storage = sessionStorage;

  constructor() {
    effect(() => {
      const expiresAt = this.store.accessTokenExpiresAt();
      if (expiresAt) this.scheduleRefresh(expiresAt);
    });
    this.destroyRef.onDestroy(() => this.clearRefreshTimer());
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  initialize(): Observable<boolean> {
    const refreshToken =
      sessionStorage.getItem(STORAGE.refresh) ?? localStorage.getItem(STORAGE.refresh);
    if (!refreshToken) {
      this.store.reset();
      return of(false);
    }
    this.refreshStorage = sessionStorage.getItem(STORAGE.refresh) ? sessionStorage : localStorage;
    const restored = this.restoreAccessToken(refreshToken);
    return (restored ? of(true) : this.refresh(refreshToken)).pipe(
      switchMap((ok) => (ok ? this.loadMe() : of(false))),
      tap((ok) => (ok ? this.store.markInitialized() : this.clearLocalSession())),
      catchError(() => {
        this.clearLocalSession();
        return of(false);
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Public data
  // ---------------------------------------------------------------------------

  /** Public auth policy (registration flag, password policy). Cached for the app lifetime. */
  config(): Observable<AuthConfig> {
    this.config$ ??= this.http.get<AuthConfig>(`${AUTH_API}/config`).pipe(
      catchError((err) => {
        this.config$ = undefined;
        return throwError(() => err);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.config$;
  }

  /** Organizations offered in the sign-in picker. */
  clients(): Observable<TenantSummary[]> {
    this.clients$ ??= this.http.get<{ tenants: TenantSummary[] }>(`${AUTH_API}/clients`).pipe(
      map((res) => res.tenants ?? []),
      tap((tenants) => this.store.setAvailableTenants(tenants)),
      catchError((err) => {
        this.clients$ = undefined;
        return throwError(() => err);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.clients$;
  }

  /**
   * Organizations offered in the *registration* picker — only those that opted
   * into self-registration. Deliberately not `clients()`: that list is every
   * active tenant, and the sign-up page must not publish the customer list.
   *
   * Not cached in the store either, since these are not sign-in targets.
   */
  registrationOrganizations(): Observable<TenantSummary[]> {
    this.registrationOrgs$ ??= this.http
      .get<{ tenants: TenantSummary[] }>(`${AUTH_API}/registration/organizations`)
      .pipe(
        map((res) => res.tenants ?? []),
        catchError((err) => {
          this.registrationOrgs$ = undefined;
          return throwError(() => err);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    return this.registrationOrgs$;
  }

  /** Whether an organization code is free, for inline feedback while typing. */
  checkOrganizationCode(code: string): Observable<{ code: string; available: boolean }> {
    return this.http.get<{ code: string; available: boolean }>(
      `${AUTH_API}/registration/organization-code`,
      { params: { code } }
    );
  }

  get lastClientCode(): string {
    return localStorage.getItem(STORAGE.clientCode) || DEFAULT_CLIENT_CODE;
  }

  // ---------------------------------------------------------------------------
  // Sign in
  // ---------------------------------------------------------------------------

  /**
   * Sign in. Navigates on success (dashboard / intended route), on a 2FA
   * challenge (/auth/two-factor) and on lock/disable (/auth/account-locked).
   * Other failures are rethrown for the form to display.
   */
  login(request: LoginRequest): Observable<LoginResponse> {
    this.refreshStorage = request.rememberMe ? localStorage : sessionStorage;
    const body: LoginRequest = { ...request, email: request.email.trim().toLowerCase() };
    const encryption = this.aes;

    return new Observable<LoginResponse>((observer) => {
      encryption
        .encryptLoginPayload(body)
        .then((encryptedPayload) => {
          this.http
            .post<LoginResponse>(`${AUTH_API}/login`, encryptedPayload)
            .subscribe({
              next: (res) => {
                localStorage.setItem(STORAGE.clientCode, request.clientCode);
                sessionStorage.removeItem(STORAGE.pendingEmail);
                if (res.mfaRequired) {
                  this.storeMfaChallenge(res);
                  void this.router.navigate(['/auth/two-factor'], { replaceUrl: true });
                  return;
                }
                this.completeSignIn(res);
                observer.next(res);
                observer.complete();
              },
              error: (err) => {
                const code = apiErrorCode(err);
                if (code === 'EMAIL_NOT_VERIFIED') {
                  sessionStorage.setItem(STORAGE.pendingEmail, body.email);
                }
                if (code === 'ACCOUNT_LOCKED' || code === 'ACCOUNT_DISABLED') {
                  void this.router.navigate(['/auth/account-locked'], {
                    queryParams: { reason: code === 'ACCOUNT_DISABLED' ? 'disabled' : 'locked' },
                  });
                }
                observer.error(err);
              },
            });
        })
        .catch((err) => {
          observer.error(err);
        });
    });
  }

  pendingMfaChallenge(): PendingMfaChallenge | null {
    try {
      const raw = sessionStorage.getItem(STORAGE.mfaChallenge);
      const challenge = raw ? (JSON.parse(raw) as PendingMfaChallenge) : null;
      if (!challenge?.mfaToken || Date.parse(challenge.expiresAt) <= Date.now()) {
        sessionStorage.removeItem(STORAGE.mfaChallenge);
        return null;
      }
      return challenge;
    } catch {
      sessionStorage.removeItem(STORAGE.mfaChallenge);
      return null;
    }
  }

  cancelMfaChallenge(): void {
    sessionStorage.removeItem(STORAGE.mfaChallenge);
    void this.router.navigate(['/auth/login'], { replaceUrl: true });
  }

  verifyTwoFactor(code: string): Observable<LoginSuccessResponse> {
    return this.completeChallenge('login/mfa', code);
  }

  verifyRecoveryCode(code: string): Observable<LoginSuccessResponse> {
    return this.completeChallenge('login/recovery-code', code);
  }

  /** Pending email from a sign-in blocked on verification, for the resend form. */
  get pendingVerificationEmail(): string {
    return sessionStorage.getItem(STORAGE.pendingEmail) ?? '';
  }

  // ---------------------------------------------------------------------------
  // Tokens
  // ---------------------------------------------------------------------------

  /** Rotate the token pair. Concurrent callers share one request. */
  refresh(refreshToken: string): Observable<boolean> {
    if (this.refreshRequest$) return this.refreshRequest$;
    this.refreshRequest$ = this.http
      .post<RefreshResponse>(`${AUTH_API}/refresh`, { refreshToken })
      .pipe(
        tap((res) => {
          this.store.updateTokens(res);
          this.persistTokens();
        }),
        map(() => true),
        catchError(() => {
          this.clearLocalSession();
          return of(false);
        }),
        finalize(() => (this.refreshRequest$ = undefined)),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    return this.refreshRequest$;
  }

  // ---------------------------------------------------------------------------
  // Sign out
  // ---------------------------------------------------------------------------

  /** Revoke the server session, then clear every piece of user-specific client state. */
  logout(): Observable<void> {
    const hasSession = !!this.store.accessToken();
    const revoke$ = hasSession
      ? this.http.post<void>(`${AUTH_API}/logout`, {}).pipe(catchError(() => of(undefined)))
      : of(undefined);
    return revoke$.pipe(
      map(() => undefined),
      finalize(() => {
        this.clearLocalSession();
        sessionStorage.removeItem(STORAGE.redirect);
        void this.router.navigate(['/auth/login'], { replaceUrl: true });
      })
    );
  }

  /** Revoke every session for this account (requires the password), then sign out here. */
  logoutAll(password: string): Observable<void> {
    return this.http.post<void>(`${AUTH_API}/logout-all`, { password }).pipe(
      tap(() => {
        this.clearLocalSession();
        void this.router.navigate(['/auth/login'], { replaceUrl: true });
      })
    );
  }

  /**
   * Called when the API rejects the session (expired / revoked). Keeps the
   * current route so sign-in can return to it — never replays the failed request.
   */
  expireSession(): void {
    this.clearLocalSession();
    // Already on a public page: nothing to protect, and redirecting could loop.
    if (this.router.url.startsWith('/auth/')) return;
    const current = safeRedirect(this.router.url);
    if (current) sessionStorage.setItem(STORAGE.redirect, current);
    void this.router.navigate(['/auth/session-expired'], { replaceUrl: true });
  }

  // ---------------------------------------------------------------------------
  // Current user
  // ---------------------------------------------------------------------------

  loadMe(): Observable<boolean> {
    return this.http.get<MeResponse>(`${AUTH_API}/me`).pipe(
      tap((me) => {
        this.store.setProfile({
          user: me.user,
          tenant: me.tenant,
          permissions: me.permissions,
          menu: me.menu,
          mfaSetupRequired: me.mfaSetupRequired,
        });
      }),
      map(() => true),
      catchError(() => of(false))
    );
  }

  /** Pass a PNG/JPEG/WebP data URL, or null to remove the avatar. */
  updateAvatar(avatar: string | null): Observable<void> {
    return this.http.put<{ avatarUrl: string | null }>(`${AUTH_API}/me/avatar`, { avatar }).pipe(
      tap(({ avatarUrl }) => this.store.patchUser({ avatarUrl })),
      map(() => undefined)
    );
  }

  // ---------------------------------------------------------------------------
  // Onboarding
  // ---------------------------------------------------------------------------

  register(request: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${AUTH_API}/register`, request);
  }

  previewInvitation(token: string): Observable<InvitationPreview> {
    return this.http.post<InvitationPreview>(`${AUTH_API}/invitations/preview`, { token });
  }

  acceptInvitation(request: AcceptInvitationRequest): Observable<AcceptInvitationResponse> {
    return this.http.post<AcceptInvitationResponse>(`${AUTH_API}/invitations/accept`, request).pipe(
      tap((res) => {
        if (res.clientCode) localStorage.setItem(STORAGE.clientCode, res.clientCode.toLowerCase());
      })
    );
  }

  verifyEmail(token: string): Observable<VerifyEmailResponse> {
    return this.http
      .post<VerifyEmailResponse>(`${AUTH_API}/verify-email`, { token })
      .pipe(tap(() => sessionStorage.removeItem(STORAGE.pendingEmail)));
  }

  resendVerification(email: string): Observable<GenericMessageResponse> {
    return this.http.post<GenericMessageResponse>(`${AUTH_API}/resend-verification`, { email });
  }

  // ---------------------------------------------------------------------------
  // Password
  // ---------------------------------------------------------------------------

  forgotPassword(email: string): Observable<GenericMessageResponse> {
    return this.http.post<GenericMessageResponse>(`${AUTH_API}/forgot-password`, { email });
  }

  validateResetToken(token: string): Observable<boolean> {
    return this.http
      .post<{ valid: boolean }>(`${AUTH_API}/reset-password/validate`, { token })
      .pipe(map((res) => res.valid));
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>(`${AUTH_API}/reset-password`, request);
  }

  changePassword(request: ChangePasswordRequest): Observable<ChangePasswordResponse> {
    return this.http.post<ChangePasswordResponse>(`${AUTH_API}/change-password`, request);
  }

  // ---------------------------------------------------------------------------
  // Account security
  // ---------------------------------------------------------------------------

  securityOverview(): Observable<SecurityOverview> {
    return this.http.get<SecurityOverview>(`${AUTH_API}/security`);
  }

  startMfaEnrollment(password: string): Observable<MfaEnrollStartResponse> {
    return this.http.post<MfaEnrollStartResponse>(`${AUTH_API}/mfa/enroll`, { password });
  }

  confirmMfaEnrollment(
    enrollmentToken: string,
    code: string
  ): Observable<MfaEnrollConfirmResponse> {
    return this.http
      .post<MfaEnrollConfirmResponse>(`${AUTH_API}/mfa/confirm`, { enrollmentToken, code })
      .pipe(
        tap(() => {
          this.store.patchUser({ mfaEnabled: true });
          this.store.setMfaSetupRequired(false);
          sessionStorage.removeItem(STORAGE.lowRecoveryCodes);
        })
      );
  }

  disableMfa(password: string, code: string): Observable<void> {
    return this.http
      .post<void>(`${AUTH_API}/mfa/disable`, { password, code })
      .pipe(tap(() => this.store.patchUser({ mfaEnabled: false })));
  }

  regenerateRecoveryCodes(password: string): Observable<MfaRecoveryCodesResponse> {
    return this.http
      .post<MfaRecoveryCodesResponse>(`${AUTH_API}/mfa/recovery-codes`, { password })
      .pipe(tap(() => sessionStorage.removeItem(STORAGE.lowRecoveryCodes)));
  }

  sessions(): Observable<ActiveSession[]> {
    return this.http
      .get<{ sessions: ActiveSession[] }>(`${AUTH_API}/sessions`)
      .pipe(map((res) => res.sessions));
  }

  revokeSession(sessionId: string): Observable<void> {
    return this.http.delete<void>(`${AUTH_API}/sessions/${encodeURIComponent(sessionId)}`);
  }

  revokeOtherSessions(): Observable<{ revoked: number }> {
    return this.http.delete<{ revoked: number }>(`${AUTH_API}/sessions`);
  }

  /** Set after a recovery-code sign-in left few codes; drives the regenerate prompt. */
  get lowRecoveryCodes(): number | null {
    const value = sessionStorage.getItem(STORAGE.lowRecoveryCodes);
    return value === null ? null : Number(value);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private completeChallenge(path: string, code: string): Observable<LoginSuccessResponse> {
    const challenge = this.pendingMfaChallenge();
    if (!challenge) {
      void this.router.navigate(['/auth/login'], { replaceUrl: true });
      return throwError(() => new Error('No pending two-factor challenge'));
    }
    return this.http
      .post<LoginSuccessResponse>(`${AUTH_API}/${path}`, { mfaToken: challenge.mfaToken, code })
      .pipe(
        tap((res) => {
          sessionStorage.removeItem(STORAGE.mfaChallenge);
          this.completeSignIn(res);
        }),
        catchError((err) => {
          const errorCode = apiErrorCode(err);
          // The server discards the challenge on expiry / exhausted attempts.
          if (errorCode === 'MFA_CHALLENGE_EXPIRED' || errorCode === 'MFA_TOO_MANY_ATTEMPTS') {
            sessionStorage.removeItem(STORAGE.mfaChallenge);
          }
          return throwError(() => err);
        })
      );
  }

  private storeMfaChallenge(res: MfaChallengeResponse): void {
    const pending: PendingMfaChallenge = {
      mfaToken: res.mfaToken,
      mfaMethod: res.mfaMethod,
      expiresAt: res.expiresAt,
    };
    sessionStorage.setItem(STORAGE.mfaChallenge, JSON.stringify(pending));
  }

  private completeSignIn(res: LoginSuccessResponse): void {
    // A new identity must never inherit the previous user's cached policy.
    this.policy.clear();
    this.store.setSession({
      user: res.user,
      tenant: res.tenant,
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      accessTokenExpiresAt: res.accessTokenExpiresAt,
      refreshTokenExpiresAt: res.refreshTokenExpiresAt,
      sessionId: res.sessionId,
    });
    this.store.setMfaSetupRequired(res.mfaSetupRequired);
    this.store.markInitialized();
    this.persistTokens();

    if (
      res.recoveryCodesRemaining !== undefined &&
      res.recoveryCodesRemaining <= LOW_RECOVERY_CODE_THRESHOLD
    ) {
      sessionStorage.setItem(STORAGE.lowRecoveryCodes, String(res.recoveryCodesRemaining));
    }

    this.loadMe().subscribe();

    const intended = safeRedirect(sessionStorage.getItem(STORAGE.redirect));
    sessionStorage.removeItem(STORAGE.redirect);
    const destination = res.mfaSetupRequired
      ? '/account/security'
      : this.lowRecoveryCodes !== null
        ? '/account/security'
        : (intended ?? safeRedirect(res.defaultLandingPage) ?? '/dashboard');
    void this.router.navigateByUrl(destination, { replaceUrl: true });
  }

  private scheduleRefresh(expiresAt: Date): void {
    this.clearRefreshTimer();
    const msUntilRefresh = Math.max(expiresAt.getTime() - Date.now() - 60_000, 5_000);
    this.refreshTimer = timer(msUntilRefresh).subscribe(() => {
      const refreshToken = this.store.refreshToken();
      if (!refreshToken) return;
      this.refresh(refreshToken).subscribe((ok) => {
        if (!ok) this.expireSession();
      });
    });
  }

  private clearRefreshTimer(): void {
    this.refreshTimer?.unsubscribe();
    this.refreshTimer = null;
  }

  private persistTokens(): void {
    const state = this.store.snapshot();
    if (!state.accessToken || !state.refreshToken) return;
    const otherStorage = this.refreshStorage === localStorage ? sessionStorage : localStorage;
    otherStorage.removeItem(STORAGE.refresh);
    this.refreshStorage.setItem(STORAGE.refresh, state.refreshToken);
    sessionStorage.setItem(
      STORAGE.tokens,
      JSON.stringify({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        accessTokenExpiresAt: state.accessTokenExpiresAt?.toISOString(),
        refreshTokenExpiresAt: state.refreshTokenExpiresAt?.toISOString(),
        sessionId: state.sessionId,
      })
    );
  }

  private restoreAccessToken(refreshToken: string): boolean {
    try {
      const tokens = JSON.parse(
        sessionStorage.getItem(STORAGE.tokens) ?? 'null'
      ) as RefreshResponse | null;
      if (
        !tokens ||
        tokens.refreshToken !== refreshToken ||
        !tokens.accessToken ||
        !tokens.sessionId ||
        !(Date.parse(tokens.accessTokenExpiresAt) > Date.now() + 60_000) ||
        !(Date.parse(tokens.refreshTokenExpiresAt) > Date.now())
      ) {
        return false;
      }
      // Only a scheduling hint: /me still verifies this token server-side.
      this.store.updateTokens(tokens);
      return true;
    } catch {
      sessionStorage.removeItem(STORAGE.tokens);
      return false;
    }
  }

  private clearLocalSession(): void {
    this.clearRefreshTimer();
    sessionStorage.removeItem(STORAGE.tokens);
    sessionStorage.removeItem(STORAGE.refresh);
    sessionStorage.removeItem(STORAGE.mfaChallenge);
    sessionStorage.removeItem(STORAGE.lowRecoveryCodes);
    localStorage.removeItem(STORAGE.refresh);
    this.policy.clear();
    this.store.reset();
  }

  // ---------------------------------------------------------------------------
  // Signal accessors for components
  // ---------------------------------------------------------------------------

  get isAuthenticated() {
    return this.store.isAuthenticated;
  }

  get user() {
    return this.store.user;
  }
}
