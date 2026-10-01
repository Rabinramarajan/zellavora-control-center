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
  imports: [FormField, FormRoot, OtpInputComponent, AuthAlertComponent, ReauthFormComponent, RecoveryCodesComponent],
  template: `
    <section class="auth-card-panel" aria-labelledby="tfa-heading">
      <div class="card-head">
        <div>
          <h2 id="tfa-heading" class="card-title">Two-factor authentication</h2>
          <p class="card-copy">
            Require a code from an authenticator app in addition to your password.
          </p>
        </div>
        <span class="badge" [class.badge--on]="enabled()">
          {{ enabled() ? 'On' : 'Off' }}
        </span>
      </div>

      @if (notice()) {
        <app-auth-alert tone="success">{{ notice() }}</app-auth-alert>
      }

      @switch (step()) {
        @case ('idle') {
          @if (requiredByOrg() && !enabled()) {
            <app-auth-alert tone="warning" heading="Required by your organization">
              Set up two-factor authentication to keep using ZCC.
            </app-auth-alert>
          }
          @if (enabled() && lowCodes() !== null) {
            <app-auth-alert tone="warning" heading="Running low on recovery codes">
              You have {{ lowCodes() }} recovery code{{ lowCodes() === 1 ? '' : 's' }} left. Generate a new set.
            </app-auth-alert>
          }
          <div class="card-actions">
            @if (enabled()) {
              <p class="card-meta">
                {{ recoveryCodesRemaining() }} of 10 recovery codes remaining.
              </p>
              <button type="button" class="auth-btn auth-btn--secondary auth-btn--inline" (click)="go('reauth-regenerate')">
                Regenerate recovery codes
              </button>
              @if (!requiredByOrg()) {
                <button type="button" class="auth-btn auth-btn--secondary auth-btn--inline danger-text" (click)="go('reauth-disable')">
                  Turn off
                </button>
              }
            } @else {
              <button type="button" class="auth-btn auth-btn--primary auth-btn--inline" (click)="go('reauth-enable')">
                Set up two-factor authentication
              </button>
            }
          </div>
        }

        @case ('reauth-enable') {
          <app-reauth-form
            prompt="Confirm your password to start setup."
            submitLabel="Continue"
            [busy]="busy()"
            [error]="error()"
            (confirmed)="startEnrollment($event)"
            (cancelled)="go('idle')"
          />
        }

        @case ('scan') {
          @if (enrollment(); as e) {
            <ol class="steps">
              <li>
                <p class="step-title">Scan this QR code with your authenticator app</p>
                <img class="qr" [src]="e.qrCodeDataUrl" width="176" height="176" alt="QR code for adding ZCC to your authenticator app" />
                <details class="manual">
                  <summary>Can't scan? Enter the key manually</summary>
                  <code class="secret">{{ e.secret }}</code>
                </details>
              </li>
              <li>
                <p class="step-title">Enter the 6-digit code the app shows</p>
                @if (error()) {
                  <app-auth-alert tone="error">{{ error() }}</app-auth-alert>
                }
                <form class="auth-form" [formRoot]="codeForm" aria-label="Verify authenticator code">
                  <app-otp-input [formField]="codeForm.code" />
                  <div class="card-actions card-actions--end">
                    <button type="button" class="auth-btn auth-btn--secondary auth-btn--inline" (click)="go('idle')">Cancel</button>
                    <button type="submit" class="auth-btn auth-btn--primary auth-btn--inline" [disabled]="codeForm().submitting()">
                      @if (codeForm().submitting()) {
                        <span class="auth-spinner" aria-hidden="true"></span>
                      }
                      <span>Verify and turn on</span>
                    </button>
                  </div>
                </form>
              </li>
            </ol>
          }
        }

        @case ('codes') {
          <app-recovery-codes [codes]="recoveryCodes()" (done)="finishCodes()" />
        }

        @case ('reauth-disable') {
          <app-reauth-form
            prompt="Turning off two-factor authentication makes your account easier to compromise. Confirm with your password and a code."
            submitLabel="Turn off"
            [requireCode]="true"
            [danger]="true"
            [busy]="busy()"
            [error]="error()"
            (confirmed)="disable($event)"
            (cancelled)="go('idle')"
          />
        }

        @case ('reauth-regenerate') {
          <app-reauth-form
            prompt="New codes replace your current set immediately. Confirm your password to continue."
            submitLabel="Generate new codes"
            [busy]="busy()"
            [error]="error()"
            (confirmed)="regenerate($event)"
            (cancelled)="go('idle')"
          />
        }
      }
    </section>
  `,
  styleUrl: './account-card.css',
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
  protected readonly codeForm = form(
    this.codeModel,
    (path) => otpRules(path.code),
    { submission: { action: () => this.confirmEnrollment() } }
  );

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
        this.auth.confirmMfaEnrollment(enrollment.enrollmentToken, normalizeOtp(this.codeModel().code))
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
