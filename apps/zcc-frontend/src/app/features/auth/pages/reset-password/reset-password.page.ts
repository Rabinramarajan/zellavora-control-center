import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiErrorCode } from '../../../../core/auth/auth-errors';
import { AuthFieldComponent } from '../../ui/auth-field.component';
import { AuthAlertComponent } from '../../ui/auth-alert.component';
import { PasswordRequirementsComponent } from '../../ui/password-requirements.component';
import { confirmPasswordRules, newPasswordRules } from '../../ui/auth-validation';
import { injectPasswordPolicy, mapServerErrors, takeQueryToken } from '../../ui/form-errors';

type TokenState = 'checking' | 'valid' | 'invalid';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [
    FormField,
    FormRoot,
    RouterLink,
    AuthFieldComponent,
    AuthAlertComponent,
    PasswordRequirementsComponent,
  ],
  template: `
    <section class="auth-page" aria-labelledby="reset-title" [attr.aria-busy]="tokenState() === 'checking'">
      <header>
        <h1 id="reset-title" class="auth-title">Choose a new password</h1>
        <p class="auth-lead">Your new password will sign you out of other devices.</p>
      </header>

      @switch (tokenState()) {
        @case ('checking') {
          <p class="auth-lead" role="status">Checking your reset link…</p>
        }
        @case ('invalid') {
          <app-auth-alert tone="error" heading="Link invalid or expired">
            This reset link is invalid or has expired. Request a new one.
          </app-auth-alert>
          <a class="auth-btn auth-btn--primary" routerLink="/auth/forgot-password">Request a new link</a>
        }
        @case ('valid') {
          @if (formError()) {
            <app-auth-alert tone="error">{{ formError() }}</app-auth-alert>
          }
          <form class="auth-form" [formRoot]="form" aria-labelledby="reset-title">
            <div>
              <app-auth-field
                [formField]="form.password"
                label="New password"
                type="password"
                autocomplete="new-password"
              />
              <app-password-requirements [password]="model().password" [policy]="policy()" />
            </div>
            <app-auth-field
              [formField]="form.confirmPassword"
              label="Confirm new password"
              type="password"
              autocomplete="new-password"
            />
            <button type="submit" class="auth-btn auth-btn--primary" [disabled]="form().submitting()">
              @if (form().submitting()) {
                <span class="auth-spinner" aria-hidden="true"></span><span>Updating…</span>
              } @else {
                <span>Reset password</span>
              }
            </button>
          </form>
        }
      }

      <p class="auth-footer-note">
        <a class="auth-link" routerLink="/auth/login">Back to sign in</a>
      </p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly token = takeQueryToken();

  protected readonly policy = injectPasswordPolicy();
  protected readonly tokenState = signal<TokenState>(this.token ? 'checking' : 'invalid');
  protected readonly formError = signal<string | null>(null);
  protected readonly model = signal({ password: '', confirmPassword: '' });

  protected readonly form = form(
    this.model,
    (path) => {
      newPasswordRules(path.password, this.policy);
      confirmPasswordRules(path.confirmPassword, () => this.model().password);
    },
    { submission: { action: () => this.submit() } }
  );

  constructor() {
    if (this.token) void this.checkToken();
  }

  private async checkToken(): Promise<void> {
    try {
      const valid = await firstValueFrom(this.auth.validateResetToken(this.token));
      this.tokenState.set(valid ? 'valid' : 'invalid');
    } catch {
      this.tokenState.set('invalid');
    }
  }

  private async submit() {
    this.formError.set(null);
    try {
      await firstValueFrom(
        this.auth.resetPassword({ token: this.token, newPassword: this.model().password })
      );
      await this.router.navigate(['/auth/password-reset-success'], {
        replaceUrl: true,
      });
      return undefined;
    } catch (err) {
      if (apiErrorCode(err) === 'INVALID_RESET_TOKEN') {
        this.tokenState.set('invalid');
        return undefined;
      }
      const { fieldErrors, message } = mapServerErrors(
        err,
        { password: this.form.password },
        "We couldn't reset your password. Please try again.",
        { newPassword: 'password' }
      );
      this.formError.set(message);
      return fieldErrors;
    }
  }
}
