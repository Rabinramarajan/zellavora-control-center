import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import type { MfaEnrollStartResponse } from '../../../shared/models';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/auth/auth-errors';
import { OtpInputComponent } from '../../auth/ui/otp-input.component';
import { AuthAlertComponent } from '../../auth/ui/auth-alert.component';
import { normalizeOtp, otpRules } from '../../auth/ui/auth-validation';
import { ReauthFormComponent, type ReauthSubmission } from './reauth-form.component';
import { RecoveryCodesComponent } from './recovery-codes.component';

type Step = 'idle' | 'reauth-enable' | 'scan' | 'codes' | 'reauth-disable' | 'reauth-regenerate';

@Component({
  selector: 'app-two-factor-card',
  standalone: true,
  imports: [
    FormField,
    FormRoot,
    OtpInputComponent,
    AuthAlertComponent,
    ReauthFormComponent,
    RecoveryCodesComponent,
  ],
  templateUrl: './two-factor-card.component.html',
  styleUrl: './account-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TwoFactorCardComponent {
  private readonly auth = inject(AuthService);

  readonly enabled = input(false);
  readonly requiredByOrg = input(false);
  readonly recoveryCodesRemaining = input(0);
  readonly changed = output<void>();

  protected readonly step = signal<Step>('idle');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly enrollment = signal<MfaEnrollStartResponse | null>(null);
  protected readonly recoveryCodes = signal<readonly string[]>([]);
  protected readonly lowCodes = signal(this.auth.lowRecoveryCodes);

  private readonly codeModel = signal({ code: '' });
  protected readonly codeForm = form(this.codeModel, (path) => otpRules(path.code), {
    submission: { action: () => this.confirmEnrollment() },
  });

  protected go(step: Step): void {
    this.error.set(null);
    this.notice.set(null);
    if (step === 'idle') this.enrollment.set(null);
    this.step.set(step);
  }

  protected startEnrollment({ password }: ReauthSubmission): Promise<void> {
    return this.run(async () => {
      this.enrollment.set(await firstValueFrom(this.auth.startMfaEnrollment(password)));
      this.codeModel.set({ code: '' });
      this.step.set('scan');
    }, "We couldn't start setup. Please try again.");
  }

  protected disable({ password, code }: ReauthSubmission): Promise<void> {
    return this.run(async () => {
      await firstValueFrom(this.auth.disableMfa(password, code));
      this.step.set('idle');
      this.notice.set('Two-factor authentication is off.');
      this.changed.emit();
    }, "We couldn't turn off two-factor authentication.");
  }

  protected regenerate({ password }: ReauthSubmission): Promise<void> {
    return this.run(async () => {
      const res = await firstValueFrom(this.auth.regenerateRecoveryCodes(password));
      this.recoveryCodes.set(res.recoveryCodes);
      this.lowCodes.set(null);
      this.step.set('codes');
    }, "We couldn't generate new codes.");
  }

  protected finishCodes(): void {
    this.recoveryCodes.set([]);
    this.step.set('idle');
    this.notice.set(this.enabled() ? 'Your recovery codes are ready.' : null);
    this.changed.emit();
  }

  private async confirmEnrollment() {
    const enrollment = this.enrollment();
    if (!enrollment) return undefined;
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.auth.confirmMfaEnrollment(
          enrollment.enrollmentToken,
          normalizeOtp(this.codeModel().code)
        )
      );
      this.enrollment.set(null);
      this.recoveryCodes.set(res.recoveryCodes);
      this.step.set('codes');
      this.changed.emit();
    } catch (err) {
      this.codeModel.set({ code: '' });
      this.error.set(apiErrorMessage(err, 'The verification code is invalid or expired.'));
    }
    return undefined;
  }

  private async run(action: () => Promise<void>, fallback: string): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (err) {
      this.error.set(apiErrorMessage(err, fallback));
    } finally {
      this.busy.set(false);
    }
  }
}
