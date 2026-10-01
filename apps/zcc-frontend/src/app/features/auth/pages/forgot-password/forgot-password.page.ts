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
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [FormField, FormRoot, RouterLink, AuthFieldComponent, AuthAlertComponent],
  templateUrl: './forgot-password.page.html',
  styleUrl: './forgot-password.page.scss',
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
