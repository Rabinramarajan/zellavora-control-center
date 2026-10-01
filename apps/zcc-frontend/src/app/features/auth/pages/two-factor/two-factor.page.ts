import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, FormRoot, form, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiErrorCode, apiErrorMessage } from '../../../../core/auth/auth-errors';
import { OtpInputComponent } from '../../ui/otp-input.component';
import { AuthAlertComponent } from '../../ui/auth-alert.component';
import { normalizeOtp, otpRules } from '../../ui/auth-validation';

@Component({
  selector: 'app-two-factor-page',
  standalone: true,
  imports: [FormField, FormRoot, RouterLink, OtpInputComponent, AuthAlertComponent],
  templateUrl: './two-factor.page.html',
  styleUrl: './two-factor.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TwoFactorPage {
  private readonly auth = inject(AuthService);
  private readonly challenge = this.auth.pendingMfaChallenge();

  protected readonly method = computed(() => this.challenge?.mfaMethod ?? 'totp');
  protected readonly formError = signal<string | null>(null);
  protected readonly expired = signal(!this.challenge);

  private readonly model = signal({ code: '' });
  protected readonly form = form(this.model, (path) => otpRules(path.code), {
    submission: { action: () => this.verify() },
  });

  protected autoSubmit(): void {
    if (!this.form().submitting()) void submit(this.form);
  }

  protected cancel(): void {
    this.auth.cancelMfaChallenge();
  }

  private async verify() {
    this.formError.set(null);
    try {
      await firstValueFrom(this.auth.verifyTwoFactor(normalizeOtp(this.model().code)));
      return undefined;
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === 'MFA_CHALLENGE_EXPIRED' || code === 'MFA_TOO_MANY_ATTEMPTS') {
        this.expired.set(true);
        return undefined;
      }
      this.model.set({ code: '' });
      this.formError.set(apiErrorMessage(err, 'The verification code is invalid or expired.'));
      return undefined;
    }
  }
}
