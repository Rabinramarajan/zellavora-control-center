import { Injectable, inject } from '@angular/core';
import { Observable, throwError, of, timer } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthApiService } from '@core/api/auth.api';
import { AuthStore } from '@core/auth/auth.store';
import {
  LoginRequest,
  LoginResponse,
  LoginMfaRequest,
  LoginSuccessResponse,
  RefreshResponse,
  MeResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  SwitchTenantRequest,
  ValidateClientResponse,
  MfaEnrollStartResponse,
  MfaEnrollConfirmRequest,
  MfaEnrollConfirmResponse,
  MfaDisableRequest,
  MfaRecoveryCodesResponse,
  TenantSummary,
} from '@shared/models';

@Injectable({ providedIn: 'root' })
export class AuthRepository {
  private readonly api = inject(AuthApiService);
  private readonly store = inject(AuthStore);

  // Expose signals from the store so that components can access them reactively
  readonly user = this.store.user;
  readonly tenant = this.store.tenant;
  readonly tenants = this.store.tenants;
  readonly permissions = this.store.permissions;
  readonly menu = this.store.menu;
  readonly isAuthenticated = this.store.isAuthenticated;
  readonly isLoading = this.store.isLoading;
  readonly error = this.store.error;
  readonly errorCode = this.store.errorCode;
  readonly role = this.store.role;
  readonly tenantId = this.store.tenantId;

  // Cached in-memory values or methods supporting caching/retries
  private cachedTenants: TenantSummary[] | null = null;

  validateClient(clientCode: string): Observable<ValidateClientResponse> {
    return this.api.validateClientCode(clientCode).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  getPublicKey(): Observable<any> {
    return this.api.getPublicKey().pipe(
      catchError((error) => this.handleError(error))
    );
  }

  login(request: any, headers?: Record<string, string>): Observable<LoginResponse> {
    this.store.setLoading(true);
    this.store.setError(null);
    return this.api.login(request, headers).pipe(
      tap((res) => {
        if ('mfaRequired' in res && !res.mfaRequired) {
          this.setSession(res);
        }
      }),
      catchError((error) => {
        const errorMsg = error.message || 'Login failed';
        const errorCode = error.code || null;
        this.store.setError(errorMsg, errorCode);
        this.store.setLoading(false);
        return throwError(() => error);
      })
    );
  }

  loginMfa(request: LoginMfaRequest): Observable<LoginSuccessResponse> {
    this.store.setLoading(true);
    this.store.setError(null);
    return this.api.loginMfa(request).pipe(
      tap((res) => this.setSession(res)),
      catchError((error) => {
        const errorMsg = error.message || 'MFA validation failed';
        const errorCode = error.code || null;
        this.store.setError(errorMsg, errorCode);
        this.store.setLoading(false);
        return throwError(() => error);
      })
    );
  }

  refresh(refreshToken: string): Observable<RefreshResponse> {
    return this.api.refresh(refreshToken).pipe(
      tap((res) => {
        this.store.updateTokens(res);
        sessionStorage.setItem('zcc.refresh', res.refreshToken);
      }),
      catchError((error) => {
        this.clearSession();
        return throwError(() => error);
      })
    );
  }

  logout(): Observable<void> {
    return this.api.logout().pipe(
      tap(() => this.clearSession()),
      catchError((error) => {
        this.clearSession();
        return of(void 0);
      })
    );
  }

  logoutAll(): Observable<void> {
    return this.api.logoutAll().pipe(
      tap(() => this.clearSession()),
      catchError((error) => {
        this.clearSession();
        return throwError(() => error);
      })
    );
  }

  loadMe(): Observable<MeResponse> {
    return this.api.loadMe().pipe(
      tap((me) => {
        this.store.setMeContext({
          permissions: me.permissions,
          menu: me.menu,
        });
      }),
      catchError((error) => this.handleError(error))
    );
  }

  loadAvailableTenants(bypassCache = false): Observable<{ tenants: TenantSummary[] }> {
    if (this.cachedTenants && !bypassCache) {
      return of({ tenants: this.cachedTenants });
    }
    return this.api.loadAvailableTenants().pipe(
      tap((res) => {
        this.cachedTenants = res.tenants;
        this.store.setAvailableTenants(res.tenants);
      }),
      catchError((error) => this.handleError(error))
    );
  }

  switchTenant(request: SwitchTenantRequest): Observable<LoginSuccessResponse> {
    this.store.setLoading(true);
    return this.api.switchTenant(request).pipe(
      tap((res) => {
        this.cachedTenants = null; // Clear cached tenants upon switch
        this.setSession(res);
      }),
      catchError((error) => {
        const errorMsg = error.message || 'Tenant switch failed';
        const errorCode = error.code || null;
        this.store.setError(errorMsg, errorCode);
        this.store.setLoading(false);
        return throwError(() => error);
      })
    );
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<void> {
    return this.api.forgotPassword(request).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.api.resetPassword(request).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.api.changePassword(request).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  startMfaEnrollment(): Observable<MfaEnrollStartResponse> {
    return this.api.startMfaEnrollment().pipe(
      catchError((error) => this.handleError(error))
    );
  }

  confirmMfaEnrollment(request: MfaEnrollConfirmRequest): Observable<MfaEnrollConfirmResponse> {
    return this.api.confirmMfaEnrollment(request).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  disableMfa(request: MfaDisableRequest): Observable<void> {
    return this.api.disableMfa(request).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  regenerateRecoveryCodes(): Observable<MfaRecoveryCodesResponse> {
    return this.api.regenerateRecoveryCodes().pipe(
      catchError((error) => this.handleError(error))
    );
  }

  // Helper session states
  private setSession(res: LoginSuccessResponse): void {
    this.store.setSession({
      user: res.user,
      tenant: res.tenant,
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      accessTokenExpiresAt: res.accessTokenExpiresAt,
      refreshTokenExpiresAt: res.refreshTokenExpiresAt,
      sessionId: res.sessionId,
    });
    sessionStorage.setItem('zcc.refresh', res.refreshToken);
    sessionStorage.setItem('zcc.user', JSON.stringify(res.user));
    sessionStorage.setItem('zcc.tenantId', res.tenant.id);
  }

  private clearSession(): void {
    sessionStorage.removeItem('zcc.refresh');
    sessionStorage.removeItem('zcc.user');
    sessionStorage.removeItem('zcc.tenantId');
    this.cachedTenants = null;
    this.store.reset();
  }

  private handleError(error: any) {
    const apiError = {
      code: error.statusCode ? error.statusCode.toString() : '500',
      message: error.message || 'An unexpected error occurred',
      details: error.details || null,
    };
    return throwError(() => apiError);
  }
}
