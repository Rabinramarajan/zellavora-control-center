import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { AuthFieldComponent } from '../../ui/auth-field.component';
import { AuthAlertComponent } from '../../ui/auth-alert.component';
import { emailRules } from '../../ui/auth-validation';
import { mapServerErrors } from '../../ui/form-errors';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [FormField, FormRoot, RouterLink, AuthFieldComponent, AuthAlertComponent],
  template: `
    <section class="auth-page" aria-labelledby="forgot-title">
      <div class="auth-page__icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
        </svg>
      </div>
      <header>
        <h1 id="forgot-title" class="auth-title">Reset your password</h1>
        <p class="auth-lead">Enter the email for your account and we'll send you a reset link.</p>
      </header>

      @if (sent()) {
        <app-auth-alert tone="success" heading="Check your email">
          If an account is eligible, reset instructions will be sent to
          <strong>{{ model().email }}</strong>. The link expires shortly, so use it soon.
        </app-auth-alert>
        <p class="auth-footer-note">
          Didn't get it? Check spam, or
          <button type="button" class="auth-link" (click)="sent.set(false)">try again</button>.
        </p>
      } @else {
        @if (formError()) {
          <app-auth-alert tone="error">{{ formError() }}</app-auth-alert>
        }
        <form class="auth-form" [formRoot]="form" aria-labelledby="forgot-title">
          <app-auth-field
            [formField]="form.email"
            label="Email"
            type="email"
            autocomplete="email"
            inputmode="email"
            placeholder="name@company.com"
          />
          <button type="submit" class="auth-btn auth-btn--primary" [disabled]="form().submitting()">
            @if (form().submitting()) {
              <span class="auth-spinner" aria-hidden="true"></span><span>Sending…</span>
            } @else {
              <span>Send reset link</span>
            }
          </button>
        </form>
      }

      <p class="auth-footer-note">
        <a class="auth-link" routerLink="/auth/login">Back to sign in</a>
      </p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);

  protected readonly sent = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly model = signal({ email: '' });

  protected readonly form = form(
    this.model,
    (path) => emailRules(path.email),
    { submission: { action: () => this.submit() } }
  );

  private async submit() {
    this.formError.set(null);
    try {
      await firstValueFrom(this.auth.forgotPassword(this.model().email.trim()));
      this.sent.set(true);
      return undefined;
    } catch (err) {
      const { fieldErrors, message } = mapServerErrors(
        err,
        { email: this.form.email },
        "We couldn't send the reset link. Please try again."
      );
      this.formError.set(message);
      return fieldErrors;
    }
  }
}
