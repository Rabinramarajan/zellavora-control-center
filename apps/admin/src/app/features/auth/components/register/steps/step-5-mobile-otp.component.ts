import { Component, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterStore } from '../register.store';
import { OtpInputComponent } from '../../../../../shared/components/otp-input.component';

@Component({
  selector: 'app-step-5-mobile-otp',
  standalone: true,
  imports: [CommonModule, OtpInputComponent],
  templateUrl: './step-5-mobile-otp.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step5MobileOtpComponent implements OnDestroy {
  readonly store = inject(RegisterStore);
  readonly mobileOtpCodeInput = signal('');
  readonly mobileTimer = signal(0);
  private mobileInterval: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy() {
    this.clearTimer();
  }

  private clearTimer() {
    if (this.mobileInterval) {
      clearInterval(this.mobileInterval);
      this.mobileInterval = null;
    }
  }

  get maskedMobile(): string {
    const mobile = this.store.mobile();
    if (!mobile) return '';
    if (mobile.length <= 4) return mobile;
    return `${mobile.slice(0, 2)}••••${mobile.slice(-2)}`;
  }

  async sendMobileOtp() {
    const mobile = this.store.mobile();
    if (!mobile) return;
    const ok = await this.store.sendMobileOtp(mobile);
    if (ok) this.startTimer();
  }

  startTimer() {
    this.mobileTimer.set(900);
    this.clearTimer();
    this.mobileInterval = setInterval(() => {
      if (this.mobileTimer() > 0) {
        this.mobileTimer.update((t) => t - 1);
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

  async verifyMobileOtp() {
    const ok = await this.store.verifyMobileOtp(this.store.mobile(), this.mobileOtpCodeInput());
    if (ok) {
      this.clearTimer();
      this.store.nextStep();
      this.store.syncProgressToBackend();
    }
  }

  async resendMobileOtp() {
    const ok = await this.store.resendMobileOtp(this.store.mobile());
    if (ok) this.startTimer();
  }

  skipMobileVerification() {
    this.store.nextStep();
    this.store.syncProgressToBackend();
  }
}
