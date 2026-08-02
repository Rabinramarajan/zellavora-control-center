/**
 * AuthService — high-level authentication operations.
 *
 * Responsibilities:
 *   - Public API for login / logout / refresh / switch-tenant / MFA
 *   - Token storage (with encryption-in-transit via HTTPS) and refresh scheduling
 *   - Triggers the AuthStore updates that drive the UI
 *
 * Storage strategy:
 *   - accessToken: in-memory ONLY (signal). Never localStorage. XSS-resistant.
 *   - refreshToken: httpOnly cookie if backend supports it; otherwise sessionStorage.
 *   - tenantId + sessionId: sessionStorage (so a tab reload doesn't lose them).
 *   - user: sessionStorage (UI personalization).
 *
 * On app boot:
 *   1. Try a silent refresh using the stored refresh token
 *   2. If success, hydrate the store from /auth/me
 *   3. If failure, fall back to login
 */
import { Injectable, inject, effect, DestroyRef } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, throwError, timer, Subscription, from } from 'rxjs';
import { catchError, shareReplay, switchMap, tap } from 'rxjs/operators';

import { AuthStore } from './auth.store';
import {
  LoginRequest,
  LoginResponse,
  MfaChallengeResponse,
  LoginMfaRequest,
  LoginSuccessResponse,
  RefreshResponse,
  MeResponse,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  SwitchTenantRequest,
  ValidateClientResponse,
  MfaEnrollStartResponse,
  MfaEnrollConfirmRequest,
  MfaEnrollConfirmResponse,
  MfaDisableRequest,
  MfaRecoveryCodesResponse,
  TenantSummary,
  ApiError,
} from '@shared/models';

const STORAGE = {
  refresh: 'zcc.refresh',
  user: 'zcc.user',
  tenantId: 'zcc.tenantId',
  redirect: 'zcc.redirect',
} as const;

/** Decode a base64 string into raw bytes. */
function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Encode raw bytes as a base64 string. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly store = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  private refreshTimer: Subscription | null = null;
  private apiUrl = '/api/v1/auth';

  // "Remember me" refreshes survive the browser session (localStorage);
  // otherwise they are session-scoped (sessionStorage).
  private refreshStorage: Storage = sessionStorage;

  constructor() {
    // Effect: when isAuthenticated flips false, kick the user to /auth/login.
    effect(() => {
      if (this.store.isInitialized() && !this.store.isAuthenticated()) {
        // Only redirect if we're not already on an auth page
        const url = this.router.url;
        if (!url.startsWith('/auth/')) {
          this.router.navigate(['/auth/login'], { replaceUrl: true });
        }
      }
    });

    // Effect: schedule a refresh whenever the access token expiry changes.
    effect(() => {
      const expiresAt = this.store.accessTokenExpiresAt();
      if (!expiresAt) return;
      this.scheduleRefresh(expiresAt);
    });

    this.destroyRef.onDestroy(() => this.clearRefreshTimer());
  }

  // -------------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------------

  /**
   * Try to silently restore the session from stored tokens.
   * Safe to call on every app boot.
   */
  initialize(): Observable<boolean> {
    this.store.markInitialized();
    const refreshToken =
      sessionStorage.getItem(STORAGE.refresh) ?? localStorage.getItem(STORAGE.refresh);
    if (!refreshToken) {
      this.store.reset();
      return of(false);
    }
    // Persist into whichever storage the token came from so refreshes stay put.
    this.refreshStorage = localStorage.getItem(STORAGE.refresh) ? localStorage : sessionStorage;
    return this.refresh({ refreshToken }, { silent: true }).pipe(
      switchMap((ok) => (ok ? this.loadMe() : of(false))),
      tap((ok) => ok || this.clearLocalSession()),
      catchError(() => {
        this.clearLocalSession();
        return of(false);
      })
    );
  }

  // -------------------------------------------------------------------------
  // Client code
  // -------------------------------------------------------------------------

  validateClientCode(clientCode: string): Observable<ValidateClientResponse> {
    return this.http.post<ValidateClientResponse>(`${this.apiUrl}/validate-client`, { clientCode });
  }

  /**
   * The tenant list is public and static for the lifetime of the app, so the
   * request is shared: concurrent callers join the in-flight request and later
   * callers replay the cached response instead of re-hitting the API.
   */
  private clients$?: Observable<any>;

  loadClients(): Observable<any> {
    this.clients$ ??= this.http.get<any>(`${this.apiUrl}/clients`).pipe(
      tap((res) => {
        if (res && res.tenants) {
          this.store.setAvailableTenants(res.tenants);
        }
      }),
      catchError((err) => {
        // Don't cache failures — let the next caller retry.
        this.clients$ = undefined;
        return throwError(() => err);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.clients$;
  }

  // -------------------------------------------------------------------------
  // Login / MFA
  // -------------------------------------------------------------------------

  /**
   * Login. Returns either an MfaChallengeResponse (if user has MFA enabled) or
   * a LoginSuccessResponse. Callers must check `mfaRequired` on the result.
   */
  private async encryptAesCbc(
    plainText: string,
    keyBase64: string,
    ivBase64: string
  ): Promise<string> {
    const key = await crypto.subtle.importKey(
      'raw',
      base64ToBytes(keyBase64),
      { name: 'AES-CBC' },
      false,
      ['encrypt']
    );
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv: base64ToBytes(ivBase64) },
      key,
      new TextEncoder().encode(plainText)
    );
    return bytesToBase64(new Uint8Array(ciphertext));
  }

  /**
   * Login. Returns either an MfaChallengeResponse (if user has MFA enabled) or
   * a LoginSuccessResponse. Callers must check `mfaRequired` on the result.
   */
  /** Login using raw tokens (e.g. following OAuth callback redirects). */
  loginWithTokens(accessToken: string, refreshToken: string): Observable<boolean> {
    this.store.setLoading(true);
    this.store.setError(null);

    this.store.updateTokens({
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15m default
      refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7d default
      sessionId: 'oauth-session',
    });
    this.persistRefreshToken(refreshToken);

    return this.loadMe().pipe(
      tap((ok) => {
        this.store.setLoading(false);
        if (ok) {
          const redirect = sessionStorage.getItem(STORAGE.redirect) ?? '/dashboard';
          sessionStorage.removeItem(STORAGE.redirect);
          this.router.navigateByUrl(redirect, { replaceUrl: true });
        }
      }),
      catchError((err) => {
        this.clearLocalSession();
        this.store.setLoading(false);
        return of(false);
      })
    );
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    this.store.setLoading(true);
    this.store.setError(null);
    this.refreshStorage = request.rememberMe ? localStorage : sessionStorage;
    return this.http.get<string[]>(`${this.apiUrl}/gettoken`).pipe(
      switchMap((keyToken) => {
        const [keyStr, ivStr] = keyToken;
        return from(
          Promise.all([
            this.encryptAesCbc(request.clientCode, keyStr, ivStr),
            this.encryptAesCbc(request.email, keyStr, ivStr),
            this.encryptAesCbc(request.password, keyStr, ivStr),
          ])
        ).pipe(
          switchMap(([encClientCode, encEmail, encPassword]) => {
            const encryptedRequest = {
              ...request,
              clientCode: encClientCode,
              email: encEmail,
              password: encPassword,
              keyToken: keyToken,
            };
            return this.http.post<LoginResponse>(`${this.apiUrl}/login`, encryptedRequest, {
              headers: {
                'X-Payload-Encrypted': 'true',
              },
            });
          })
        );
      }),
      tap((res) => {
        if (this.isMfaChallenge(res)) {
          sessionStorage.setItem('zcc.mfaToken', res.mfaToken);
          sessionStorage.setItem('zcc.mfaMethod', (res as MfaChallengeResponse).mfaMethods?.[0] ?? 'totp');
          this.store.setLoading(false);
          this.router.navigate(['/auth/mfa-verify'], { replaceUrl: true });
          return;
        }
        this.handleSuccess(res);
      }),
      catchError((err) => {
        const code = this.extractErrorCode(err);
        if (code === 'ACCOUNT_LOCKED') {
          const details = (err as HttpErrorResponse)?.error?.error ?? {};
          this.store.setLoading(false);
          this.router.navigate(['/auth/account-locked'], {
            queryParams: {
              lockTime: details.retryAfterSeconds ?? 900,
              reason: details.message ?? 'Too many failed login attempts',
            },
          });
          return throwError(() => err);
        }
        if (code === 'ACCOUNT_SUSPENDED') {
          const details = (err as HttpErrorResponse)?.error?.error ?? {};
          this.store.setLoading(false);
          this.router.navigate(['/auth/account-suspended'], {
            queryParams: {
              reason: details.message ?? 'Account suspended by administrator',
            },
          });
          return throwError(() => err);
        }
        this.store.setError(this.extractErrorMessage(err), this.extractErrorCode(err));
        this.store.setLoading(false);
        return throwError(() => err);
      })
    );
  }

  /** Complete an MFA challenge. */
  loginMfa(request: LoginMfaRequest): Observable<LoginSuccessResponse> {
    this.store.setLoading(true);
    this.store.setError(null);
    this.refreshStorage = request.rememberMe ? localStorage : sessionStorage;
    return this.http
      .post<LoginSuccessResponse>(`${this.apiUrl}/login/mfa`, request)
      .pipe(
        tap((res) => this.handleSuccess(res)),
        catchError((err) => {
          this.store.setError(this.extractErrorMessage(err), this.extractErrorCode(err));
          this.store.setLoading(false);
          return throwError(() => err);
        })
      );
  }

  // -------------------------------------------------------------------------
  // Refresh
  // -------------------------------------------------------------------------

  /**
   * Rotate the access+refresh token pair. Used both for proactive scheduling
   * and reactively (interceptor) on 401.
   * `silent` = true suppresses loading state (background refresh).
   */
  refresh(
    { refreshToken }: { refreshToken: string },
    opts: { silent?: boolean } = {}
  ): Observable<boolean> {
    if (!opts.silent) this.store.setLoading(true);
    return this.http
      .post<RefreshResponse>(`${this.apiUrl}/refresh`, { refreshToken })
      .pipe(
        tap((res) => {
          this.store.updateTokens(res);
          this.persistRefreshToken(res.refreshToken);
        }),
        switchMap(() => of(true)),
        catchError(() => {
          this.clearLocalSession();
          return of(false);
        })
      );
  }

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------

  logout(callApi: boolean = true): Observable<void> {
    this.clearRefreshTimer();
    const obs = callApi
      ? this.http.post<void>(`${this.apiUrl}/logout`, {}).pipe(catchError(() => of(void 0)))
      : of(void 0);
    return obs.pipe(
      tap(() => {
        this.clearLocalSession();
        this.router.navigate(['/auth/login'], { replaceUrl: true });
      })
    );
  }

  /** Logout from every device / session. */
  logoutAll(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/logout-all`, {}).pipe(
      tap(() => this.clearLocalSession()),
      catchError((err) => throwError(() => err))
    );
  }

  // -------------------------------------------------------------------------
  // Tenant
  // -------------------------------------------------------------------------

  /** GET /auth/tenants — list tenants the user can switch into. */
  loadAvailableTenants(): Observable<{ tenants: TenantSummary[] }> {
    return this.http.get<{ tenants: TenantSummary[] }>(`${this.apiUrl}/tenants`).pipe(
      tap((res) => this.store.setAvailableTenants(res.tenants))
    );
  }

  /** Switch to a different tenant — rotates tokens, updates store. */
  switchTenant(req: SwitchTenantRequest): Observable<LoginSuccessResponse> {
    this.store.setLoading(true);
    return this.http
      .post<LoginSuccessResponse>(`${this.apiUrl}/switch-tenant`, req)
      .pipe(
        tap((res) => this.handleSuccess(res)),
        catchError((err) => {
          this.store.setError(this.extractErrorMessage(err), this.extractErrorCode(err));
          this.store.setLoading(false);
          return throwError(() => err);
        })
      );
  }

  // -------------------------------------------------------------------------
  // /auth/me — load the full user context
  // -------------------------------------------------------------------------

  loadMe(): Observable<boolean> {
    return this.http.get<MeResponse>(`${this.apiUrl}/me`).pipe(
      tap((me) => {
        this.store.setSession({
          user: me.user,
          tenant: me.tenant,
          accessToken: this.store.accessToken() ?? '',
          refreshToken: this.store.refreshToken() ?? '',
          accessTokenExpiresAt: this.store.accessTokenExpiresAt()?.toISOString() ?? new Date().toISOString(),
          refreshTokenExpiresAt: this.store.refreshTokenExpiresAt()?.toISOString() ?? new Date().toISOString(),
          sessionId: this.store.sessionId() ?? '',
          permissions: me.permissions,
          menu: me.menu,
        });
      }),
      switchMap(() => of(true)),
      catchError(() => of(false))
    );
  }

  // -------------------------------------------------------------------------
  // Password
  // -------------------------------------------------------------------------

  forgotPassword(req: ForgotPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/forgot-password`, req);
  }

  resetPassword(req: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/reset-password`, req);
  }

  changePassword(req: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/change-password`, req);
  }

  // -------------------------------------------------------------------------
  // MFA enrollment
  // -------------------------------------------------------------------------

  startMfaEnrollment(): Observable<MfaEnrollStartResponse> {
    return this.http.post<MfaEnrollStartResponse>(`${this.apiUrl}/mfa/enroll`, {});
  }

  confirmMfaEnrollment(req: MfaEnrollConfirmRequest): Observable<MfaEnrollConfirmResponse> {
    return this.http.post<MfaEnrollConfirmResponse>(`${this.apiUrl}/mfa/confirm`, req);
  }

  disableMfa(req: MfaDisableRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/mfa/disable`, req);
  }

  regenerateRecoveryCodes(): Observable<MfaRecoveryCodesResponse> {
    return this.http.post<MfaRecoveryCodesResponse>(`${this.apiUrl}/mfa/recovery-codes`, {});
  }

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  /** GET /auth/sessions — list all active sessions for the current user. */
  getSessions(): Observable<{ sessions: any[] }> {
    return this.http.get<{ sessions: any[] }>(`${this.apiUrl}/sessions`);
  }

  /** DELETE /auth/session/:id — revoke a specific session. */
  revokeSession(sessionId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/sessions/${sessionId}`);
  }

  /** DELETE /auth/sessions — revoke all sessions except current. */
  revokeAllSessions(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/sessions`);
  }

  // -------------------------------------------------------------------------
  // Email Verification
  // -------------------------------------------------------------------------

  /** POST /auth/send-verification — send or resend email verification OTP/link. */
  sendVerificationEmail(email: string): Observable<void> {
    sessionStorage.setItem('zcc.pendingEmail', email);
    return this.http.post<void>(`${this.apiUrl}/send-verification`, { email });
  }

  /** POST /auth/verify-email — verify email via deep-link token or OTP code. */
  verifyEmail(token: string, otp: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/verify-email`, { token, otp }).pipe(
      tap(() => sessionStorage.removeItem('zcc.pendingEmail'))
    );
  }

  /** POST /auth/resend-otp — resend verification OTP to email. */
  resendOtp(email: string): Observable<void> {
    sessionStorage.setItem('zcc.pendingEmail', email);
    return this.http.post<void>(`${this.apiUrl}/resend-otp`, { email });
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private isMfaChallenge(res: LoginResponse): res is MfaChallengeResponse {
    return (res as MfaChallengeResponse).mfaRequired === true;
  }

  private handleSuccess(res: LoginSuccessResponse): void {
    this.store.setSession({
      user: res.user,
      tenant: res.tenant,
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      accessTokenExpiresAt: res.accessTokenExpiresAt,
      refreshTokenExpiresAt: res.refreshTokenExpiresAt,
      sessionId: res.sessionId,
    });
    this.persistRefreshToken(res.refreshToken);
    this.persistUser(res.user);
    sessionStorage.setItem(STORAGE.tenantId, res.tenant.id);

    // Continue: load /me so we get permissions + menu
    this.loadMe().subscribe();

    // Redirect to the originally-requested URL, or the user's default landing
    // page, or /dashboard.
    const redirect =
      sessionStorage.getItem(STORAGE.redirect) ??
      res.defaultLandingPage ??
      '/dashboard';
    sessionStorage.removeItem(STORAGE.redirect);
    this.router.navigateByUrl(redirect, { replaceUrl: true });
  }

  private scheduleRefresh(expiresAt: Date): void {
    this.clearRefreshTimer();
    const msUntilRefresh = Math.max(expiresAt.getTime() - Date.now() - 60_000, 5_000);
    this.refreshTimer = timer(msUntilRefresh).subscribe(() => {
      const refresh = this.store.refreshToken();
      if (!refresh) return;
      this.refresh({ refreshToken: refresh }, { silent: true }).subscribe();
    });
  }

  private clearRefreshTimer(): void {
    this.refreshTimer?.unsubscribe();
    this.refreshTimer = null;
  }

  private persistRefreshToken(token: string): void {
    this.refreshStorage.setItem(STORAGE.refresh, token);
  }

  private persistUser(user: unknown): void {
    sessionStorage.setItem(STORAGE.user, JSON.stringify(user));
  }

  private clearLocalSession(): void {
    sessionStorage.removeItem(STORAGE.refresh);
    sessionStorage.removeItem(STORAGE.user);
    sessionStorage.removeItem(STORAGE.tenantId);
    localStorage.removeItem(STORAGE.refresh);
    sessionStorage.removeItem('zcc.mfaMethod');
    this.store.reset();
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const api = err.error as ApiError | null;
      if (api?.error?.message) return api.error.message;
      if (err.status === 0) return 'Cannot reach the server. Check your network.';
      if (err.status === 401) return 'Session expired. Please log in again.';
      if (err.status === 403) return 'You do not have permission to do that.';
      if (err.status === 423) return 'Account locked. Try again later.';
      if (err.status === 429) return 'Too many attempts. Please slow down.';
      if (err.status >= 500) return 'Server error. Please try again later.';
    }
    return 'An unexpected error occurred.';
  }

  private extractErrorCode(err: unknown): string | null {
    if (err instanceof HttpErrorResponse) {
      const api = err.error as ApiError | null;
      return api?.error?.code ?? null;
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Signal accessors for components
  // -------------------------------------------------------------------------

  get isAuthenticated() {
    return this.store.isAuthenticated;
  }

  get isLoading() {
    return this.store.isLoading;
  }

  get error() {
    return this.store.error;
  }

  get user() {
    return this.store.user;
  }

  get errorCode() {
    return this.store.errorCode;
  }
}
