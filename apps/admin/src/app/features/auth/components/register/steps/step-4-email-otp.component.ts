import { Component, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterStore } from '../register.store';
import { OtpInputComponent } from '../../../../../shared/components/otp-input.component';

@Component({
  selector: 'app-step-4-email-otp',
  standalone: true,
  imports: [CommonModule, OtpInputComponent],
  templateUrl: './step-4-email-otp.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step4EmailOtpComponent implements OnDestroy {
  readonly store = inject(RegisterStore);
  readonly emailOtpCodeInput = signal('');
  readonly emailTimer = signal(0);
  private emailInterval: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy() {
    this.clearTimer();
  }

  private clearTimer() {
    if (this.emailInterval) {
      clearInterval(this.emailInterval);
      this.emailInterval = null;
    }
  }

  async sendEmailOtp() {
    const email = this.store.email();
    if (!email) return;
    const ok = await this.store.sendEmailOtp(email);
    if (ok) this.startEmailTimer();
  }

  startEmailTimer() {
    this.emailTimer.set(900);
    this.clearTimer();
    this.emailInterval = setInterval(() => {
      if (this.emailTimer() > 0) {
        this.emailTimer.update((t) => t - 1);
      } else {
        this.clearTimer();
      }
    }, 1000);
  }

  formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  async verifyEmailOtp() {
    const ok = await this.store.verifyEmailOtp(this.store.email(), this.emailOtpCodeInput());
    if (ok) {
      this.clearTimer();
      this.store.nextStep();
    }
  }

  async resendEmailOtp() {
    const ok = await this.store.resendEmailOtp(this.store.email());
    if (ok) this.startEmailTimer();
  }
}
