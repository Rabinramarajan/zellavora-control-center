import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, FormRoot, form, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorCode, apiErrorMessage } from '@core/auth/auth-errors';
import { OtpInputComponent } from '../../ui/otp-input.component';
import { AuthAlertComponent } from '../../ui/auth-alert.component';
import { normalizeOtp, otpRules } from '../../ui/auth-validation';

@Component({
  selector: 'app-two-factor-page',
  standalone: true,
  imports: [FormField, FormRoot, RouterLink, OtpInputComponent, AuthAlertComponent],
  template: `
    <section class="auth-page" aria-labelledby="tfa-title">
      <div class="auth-page__icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M11 18h2" />
        </svg>
      </div>
      <header>
        <h1 id="tfa-title" class="auth-title">Two-factor authentication</h1>
        <p class="auth-lead">
          @if (method() === 'email_otp') {
            Enter the 6-digit code we emailed you.
          } @else {
            Enter the 6-digit code from your authenticator app.
          }
        </p>
      </header>

      @if (expired()) {
        <app-auth-alert tone="warning" heading="Sign-in attempt expired">
          For your security, please sign in again.
        </app-auth-alert>
        <a class="auth-btn auth-btn--primary" routerLink="/auth/login" replaceUrl>Back to sign in</a>
      } @else {
        @if (formError()) {
          <app-auth-alert tone="error">{{ formError() }}</app-auth-alert>
        }
        <form class="auth-form" [formRoot]="form" aria-labelledby="tfa-title">
          <app-otp-input [formField]="form.code" (completed)="autoSubmit()" />
          <button type="submit" class="auth-btn auth-btn--primary" [disabled]="form().submitting()">
            @if (form().submitting()) {
              <span class="auth-spinner" aria-hidden="true"></span><span>Verifying…</span>
            } @else {
              <span>Verify</span>
            }
          </button>
        </form>

        <div class="flex flex-col gap-3 items-center">
          @if (method() === 'totp') {
            <a class="auth-link" routerLink="/auth/recovery-code">Use a recovery code instead</a>
          }
          <button type="button" class="auth-link" (click)="cancel()">Cancel and back to sign in</button>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TwoFactorPage {
  private readonly auth = inject(AuthService);
  private readonly challenge = this.auth.pendingMfaChallenge();

  protected readonly method = computed(() => this.challenge?.mfaMethod ?? 'totp');
  protected readonly formError = signal<string | null>(null);
  protected readonly expired = signal(!this.challenge);

  private readonly model = signal({ code: '' });
  protected readonly form = form(
    this.model,
    (path) => otpRules(path.code),
    { submission: { action: () => this.verify() } }
  );

  protected autoSubmit(): void {
    if (!this.form().submitting()) void submit(this.form);
  }

  protected cancel(): void {
    this.auth.cancelMfaChallenge();
  }

  private async verify() {
    this.formError.set(null);
    try {
      await firstValueFrom(this.auth.verifyTwoFactor(normalizeOtp(this.model().code)));
      return undefined;
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === 'MFA_CHALLENGE_EXPIRED' || code === 'MFA_TOO_MANY_ATTEMPTS') {
        this.expired.set(true);
        return undefined;
      }
      this.model.set({ code: '' });
      this.formError.set(apiErrorMessage(err, 'The verification code is invalid or expired.'));
      return undefined;
    }
  }
}
