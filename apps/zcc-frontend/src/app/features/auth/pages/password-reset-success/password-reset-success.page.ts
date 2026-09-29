import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Generic confirmation — safe to show on direct access; exposes no account details. */
@Component({
  selector: 'app-password-reset-success-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="auth-page" aria-labelledby="reset-success-title">
      <div class="auth-page__icon auth-page__icon--success" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </div>
      <header>
        <h1 id="reset-success-title" class="auth-title">Password updated</h1>
        <p class="auth-lead" role="status">
          Your password has been reset and other sessions were signed out. Sign in with your new
          password to continue.
        </p>
      </header>
      <a class="auth-btn auth-btn--primary" routerLink="/auth/login" replaceUrl>Go to sign in</a>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordResetSuccessPage {}
