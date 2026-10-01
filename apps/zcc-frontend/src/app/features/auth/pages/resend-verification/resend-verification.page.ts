import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthFieldComponent } from '../../ui/auth-field.component';
import { AuthAlertComponent } from '../../ui/auth-alert.component';
import { emailRules } from '../../ui/auth-validation';
import { mapServerErrors } from '../../ui/form-errors';

@Component({
  selector: 'app-resend-verification-page',
  standalone: true,
  imports: [FormField, FormRoot, RouterLink, AuthFieldComponent, AuthAlertComponent],
  template: `
    <section class="auth-page" aria-labelledby="resend-title">
      <div class="auth-page__icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6 8.5-6" />
        </svg>
      </div>
      <header>
        <h1 id="resend-title" class="auth-title">Resend verification email</h1>
        <p class="auth-lead">We'll send a fresh link to confirm your email address.</p>
      </header>

      @if (sent()) {
        <app-auth-alert tone="success" heading="Request received">
          If verification is required, instructions will be sent to <strong>{{ model().email }}</strong>.
        </app-auth-alert>
      } @else {
        @if (formError()) {
          <app-auth-alert tone="error">{{ formError() }}</app-auth-alert>
        }
        <form class="auth-form" [formRoot]="form" aria-labelledby="resend-title">
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
              <span>Send verification link</span>
            }
          </button>
        </form>
      }

      <p class="auth-footer-note">
        <a class="auth-link" routerLink="/auth/login">Go to sign in</a>
      </p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResendVerificationPage {
  private readonly auth = inject(AuthService);

  protected readonly sent = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly model = signal({ email: this.auth.pendingVerificationEmail });

  protected readonly form = form(
    this.model,
    (path) => emailRules(path.email),
    { submission: { action: () => this.submit() } }
  );

  private async submit() {
    this.formError.set(null);
    try {
      await firstValueFrom(this.auth.resendVerification(this.model().email.trim()));
      this.sent.set(true);
      return undefined;
    } catch (err) {
      const { fieldErrors, message } = mapServerErrors(
        err,
        { email: this.form.email },
        "We couldn't send the email. Please try again."
      );
      this.formError.set(message);
      return fieldErrors;
    }
  }
}
