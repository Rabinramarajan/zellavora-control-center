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
  templateUrl: './resend-verification.page.html',
  styleUrl: './resend-verification.page.scss',
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
