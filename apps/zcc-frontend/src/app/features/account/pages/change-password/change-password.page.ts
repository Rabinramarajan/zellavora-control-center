import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, FormRoot, form, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
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
  templateUrl: './change-password.page.html',
  styleUrl: './change-password.page.scss',
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
