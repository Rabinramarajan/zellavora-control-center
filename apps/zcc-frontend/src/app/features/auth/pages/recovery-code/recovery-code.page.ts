import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiErrorCode, apiErrorMessage } from '../../../../core/auth/auth-errors';
import { AuthFieldComponent } from '../../ui/auth-field.component';
import { AuthAlertComponent } from '../../ui/auth-alert.component';
import { recoveryCodeRules } from '../../ui/auth-validation';

@Component({
  selector: 'app-recovery-code-page',
  standalone: true,
  imports: [FormField, FormRoot, RouterLink, AuthFieldComponent, AuthAlertComponent],
  template: `
    <section class="auth-page" aria-labelledby="recovery-title">
      <div class="auth-page__icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 8.7-8.7M17 6l2.5 2.5M14.5 8.5 16 10" />
        </svg>
      </div>
      <header>
        <h1 id="recovery-title" class="auth-title">Use a recovery code</h1>
        <p class="auth-lead">
          Enter one of the recovery codes you saved when you set up two-factor authentication.
          Each code works once.
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
        <form class="auth-form" [formRoot]="form" aria-labelledby="recovery-title">
          <app-auth-field
            class="auth-code-input auth-code-input--recovery"
            [formField]="form.code"
            label="Recovery code"
            autocomplete="off"
            placeholder="ABCDE-FGHJK"
          />
          <button type="submit" class="auth-btn auth-btn--primary" [disabled]="form().submitting()">
            @if (form().submitting()) {
              <span class="auth-spinner" aria-hidden="true"></span><span>Verifying…</span>
            } @else {
              <span>Verify recovery code</span>
            }
          </button>
        </form>

        <p class="auth-footer-note">
          <a class="auth-link" routerLink="/auth/two-factor">Back to authenticator code</a>
        </p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecoveryCodePage {
  private readonly auth = inject(AuthService);

  protected readonly formError = signal<string | null>(null);
  protected readonly expired = signal(!this.auth.pendingMfaChallenge());

  private readonly model = signal({ code: '' });
  protected readonly form = form(
    this.model,
    (path) => recoveryCodeRules(path.code),
    { submission: { action: () => this.verify() } }
  );

  private async verify() {
    this.formError.set(null);
    try {
      await firstValueFrom(this.auth.verifyRecoveryCode(this.model().code.trim()));
      return undefined;
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === 'MFA_CHALLENGE_EXPIRED' || code === 'MFA_TOO_MANY_ATTEMPTS') {
        this.expired.set(true);
        return undefined;
      }
      // Treat as a secret: never leave a rejected code in the field.
      this.model.set({ code: '' });
      this.formError.set(apiErrorMessage(err, 'The recovery code is invalid or has already been used.'));
      return undefined;
    }
  }
}
