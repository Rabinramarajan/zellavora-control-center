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
  templateUrl: './reset-password.page.html',
  styleUrl: './reset-password.page.scss',
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
