import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import {
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
export class AuthApiService {
  private readonly apiData = inject(ApiDataService);

  validateClientCode(clientCode: string): Observable<ValidateClientResponse> {
    return this.apiData.postData<ValidateClientResponse>('/auth/validate-client', { clientCode }, { hideJwt: true });
  }

  getPublicKey(): Observable<any> {
    return this.apiData.getData<any>('/auth/public-key', undefined, { hideJwt: true });
  }

  login(request: any, headers?: Record<string, string>): Observable<LoginResponse> {
    return this.apiData.postData<LoginResponse>('/auth/login', request, { hideJwt: true, headers });
  }

  loginMfa(request: LoginMfaRequest): Observable<LoginSuccessResponse> {
    return this.apiData.postData<LoginSuccessResponse>('/auth/login/mfa', request, { hideJwt: true });
  }

  refresh(refreshToken: string): Observable<RefreshResponse> {
    return this.apiData.postData<RefreshResponse>('/auth/refresh', { refreshToken }, { hideJwt: true });
  }

  logout(): Observable<void> {
    return this.apiData.postData<void>('/auth/logout', {});
  }

  logoutAll(): Observable<void> {
    return this.apiData.postData<void>('/auth/logout-all', {});
  }

  loadMe(): Observable<MeResponse> {
    return this.apiData.getData<MeResponse>('/auth/me');
  }

  loadAvailableTenants(): Observable<{ tenants: TenantSummary[] }> {
    return this.apiData.getData<{ tenants: TenantSummary[] }>('/auth/tenants');
  }

  switchTenant(request: SwitchTenantRequest): Observable<LoginSuccessResponse> {
    return this.apiData.postData<LoginSuccessResponse>('/auth/switch-tenant', request);
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<void> {
    return this.apiData.postData<void>('/auth/forgot-password', request, { hideJwt: true });
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.apiData.postData<void>('/auth/reset-password', request, { hideJwt: true });
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.apiData.postData<void>('/auth/change-password', request);
  }

  startMfaEnrollment(): Observable<MfaEnrollStartResponse> {
    return this.apiData.postData<MfaEnrollStartResponse>('/auth/mfa/enroll', {});
  }

  confirmMfaEnrollment(request: MfaEnrollConfirmRequest): Observable<MfaEnrollConfirmResponse> {
    return this.apiData.postData<MfaEnrollConfirmResponse>('/auth/mfa/confirm', request);
  }

  disableMfa(request: MfaDisableRequest): Observable<void> {
    return this.apiData.postData<void>('/auth/mfa/disable', request);
  }

  regenerateRecoveryCodes(): Observable<MfaRecoveryCodesResponse> {
    return this.apiData.postData<MfaRecoveryCodesResponse>('/auth/mfa/recovery-codes', {});
  }
}
