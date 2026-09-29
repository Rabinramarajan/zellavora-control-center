import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, FormRoot, form, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { AuthFieldComponent } from '../../../auth/ui/auth-field.component';
import { AuthAlertComponent } from '../../../auth/ui/auth-alert.component';
import { PasswordRequirementsComponent } from '../../../auth/ui/password-requirements.component';
import {
  confirmPasswordRules,
  currentPasswordRules,
  newPasswordRules,
} from '../../../auth/ui/auth-validation';
import { injectPasswordPolicy, mapServerErrors } from '../../../auth/ui/form-errors';

@Component({
  selector: 'app-change-password-page',
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
    <div class="change-pw">
      <nav aria-label="Breadcrumb">
        <a class="auth-link auth-link--small" routerLink="/account/security">← Security</a>
      </nav>
      <header>
        <h1 id="cp-title" class="auth-title">Change password</h1>
        <p class="auth-lead">You'll stay signed in here. Other devices are signed out for your protection.</p>
      </header>

      <section class="auth-card-panel">
        @if (done()) {
          <app-auth-alert tone="success" heading="Password updated">
            @if (revoked() > 0) {
              Signed out {{ revoked() }} other session{{ revoked() === 1 ? '' : 's' }}.
            } @else {
              Your new password is active.
            }
          </app-auth-alert>
          <div class="mt-4">
            <a class="auth-btn auth-btn--secondary auth-btn--inline" routerLink="/account/security">Back to security</a>
          </div>
        } @else {
          @if (formError()) {
            <app-auth-alert tone="error" class="mb-4">{{ formError() }}</app-auth-alert>
          }
          <form class="auth-form" [formRoot]="form" aria-labelledby="cp-title">
            <app-auth-field
              [formField]="form.currentPassword"
              label="Current password"
              type="password"
              autocomplete="current-password"
            />
            <div>
              <app-auth-field
                [formField]="form.newPassword"
                label="New password"
                type="password"
                autocomplete="new-password"
              />
              <app-password-requirements [password]="model().newPassword" [policy]="policy()" />
            </div>
            <app-auth-field
              [formField]="form.confirmPassword"
              label="Confirm new password"
              type="password"
              autocomplete="new-password"
            />
            <div class="actions">
              <button type="button" class="auth-btn auth-btn--secondary auth-btn--inline" (click)="cancel()">Cancel</button>
              <button type="submit" class="auth-btn auth-btn--primary auth-btn--inline" [disabled]="form().submitting()">
                @if (form().submitting()) {
                  <span class="auth-spinner" aria-hidden="true"></span><span>Updating…</span>
                } @else {
                  <span>Update password</span>
                }
              </button>
            </div>
          </form>
        }
      </section>
    </div>
  `,
  styles: `
    :host { display: block; }
    .change-pw { display: flex; flex-direction: column; gap: 1.25rem; max-width: 34rem; margin: 0 auto; padding-bottom: 2rem; }
    .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.75rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly policy = injectPasswordPolicy();
  protected readonly done = signal(false);
  protected readonly revoked = signal(0);
  protected readonly formError = signal<string | null>(null);
  protected readonly model = signal({ currentPassword: '', newPassword: '', confirmPassword: '' });

  protected readonly form = form(
    this.model,
    (path) => {
      currentPasswordRules(path.currentPassword, 'Enter your current password.');
      newPasswordRules(path.newPassword, this.policy);
      validate(path.newPassword, ({ value }) =>
        value() && value() === this.model().currentPassword
          ? { kind: 'sameAsCurrent', message: 'Choose a password different from your current one.' }
          : null
      );
      confirmPasswordRules(path.confirmPassword, () => this.model().newPassword);
    },
    { submission: { action: () => this.submit() } }
  );

  protected cancel(): void {
    void this.router.navigate(['/account/security']);
  }

  private async submit() {
    this.formError.set(null);
    const { currentPassword, newPassword } = this.model();
    try {
      const res = await firstValueFrom(this.auth.changePassword({ currentPassword, newPassword }));
      this.revoked.set(res.revokedSessions);
      this.model.set({ currentPassword: '', newPassword: '', confirmPassword: '' });
      this.done.set(true);
      return undefined;
    } catch (err) {
      const { fieldErrors, message } = mapServerErrors(
        err,
        { currentPassword: this.form.currentPassword, newPassword: this.form.newPassword },
        "We couldn't update your password. Please try again."
      );
      this.formError.set(message);
      return fieldErrors;
    }
  }
}
