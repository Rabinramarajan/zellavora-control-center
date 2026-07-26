/**
 * MfaService — orchestrates the MFA enrollment and challenge flows.
 *
 * The login flow is two-step:
 *   1. AuthService.login() returns an MfaChallengeResponse with mfaToken
 *   2. UI shows the code-entry form and calls AuthService.loginMfa()
 *
 * Enrollment is its own flow (requires the user to already be authenticated).
 */
import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';
import { MfaEnrollStartResponse, MfaEnrollConfirmResponse, MfaRecoveryCodesResponse } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class MfaService {
  private readonly auth = inject(AuthService);
  private readonly store = inject(AuthStore);

  /** True if the current user has 2FA enabled (from /auth/me). */
  isEnabled(): boolean {
    return !!this.store.user()?.mfaEnabled;
  }

  /** True if the current tenant requires 2FA. */
  isRequiredByTenant(): boolean {
    return !!((this.store.tenant() as any)?.enforce2fa);
  }

  // Enrollment
  startEnrollment() {
    return this.auth.startMfaEnrollment();
  }
  confirmEnrollment(secret: string, code: string) {
    return this.auth.confirmMfaEnrollment({ secret, code });
  }
  disable(password: string) {
    return this.auth.disableMfa({ password });
  }
  regenerateRecoveryCodes() {
    return this.auth.regenerateRecoveryCodes();
  }

  /**
   * Convenience: detect whether a login response is an MFA challenge.
   * (Pure type-narrowing helper used by the login component.)
   */
  isChallenge(res: unknown): res is { mfaRequired: true; mfaToken: string } {
    return !!(res as any)?.mfaRequired;
  }
}
