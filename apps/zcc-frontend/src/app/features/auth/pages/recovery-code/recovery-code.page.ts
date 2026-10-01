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
  templateUrl: './recovery-code.page.html',
  styleUrl: './recovery-code.page.scss',
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
