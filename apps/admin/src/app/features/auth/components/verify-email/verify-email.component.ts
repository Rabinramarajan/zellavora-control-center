import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './verify-email.component.html',
  styleUrls: ['../../auth-shell.css', './verify-email.component.css'],
})
export class VerifyEmailComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  step = signal<'otp' | 'verifying' | 'success' | 'error'>('otp');
  isLoading = signal<boolean>(false);
  errorMsg = signal<string>('');
  email = signal<string>('');
  resendTimer = signal<number>(0);
  otpDigits = signal<string[]>(['', '', '', '', '', '']);
  private timerInterval: any;

  ngOnInit() {
    // Deep-link: ?token=xxx auto-verifies
    const token = this.route.snapshot.queryParamMap.get('token');
    const email =
      this.route.snapshot.queryParamMap.get('email') ||
      sessionStorage.getItem('zcc.pendingEmail') ||
      '';
    this.email.set(email);
    if (token) {
      this.verifyWithToken(token);
    } else {
      this.startResendTimer();
    }
  }

  ngOnDestroy() {
    clearInterval(this.timerInterval);
  }

  startResendTimer() {
    this.resendTimer.set(60);
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.resendTimer() > 0) {
        this.resendTimer.update((t) => t - 1);
      } else {
        clearInterval(this.timerInterval);
      }
    }, 1000);
  }

  get otpValue(): string {
    return this.otpDigits().join('');
  }

  onOtpInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    const digits = [...this.otpDigits()];
    digits[index] = val;
    this.otpDigits.set(digits);
    if (val && index < 5) {
      document.getElementById(`vemail-otp-${index + 1}`)?.focus();
    }
  }

  onOtpKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace' && !this.otpDigits()[index] && index > 0) {
      document.getElementById(`vemail-otp-${index - 1}`)?.focus();
    }
  }

  onOtpPaste(event: ClipboardEvent) {
    const pasted =
      event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) ||
      '';
    if (pasted.length === 6) {
      this.otpDigits.set(pasted.split(''));
      event.preventDefault();
    }
  }

  async verifyWithToken(token: string) {
    this.step.set('verifying');
    try {
      await firstValueFrom(this.auth.verifyEmail(token, ''));
      this.step.set('success');
    } catch {
      this.step.set('error');
      this.errorMsg.set('Verification link is invalid or has expired.');
    }
  }

  async verifyOtp() {
    if (this.otpValue.length !== 6) {
      this.errorMsg.set('Please enter all 6 digits.');
      return;
    }
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      await firstValueFrom(this.auth.verifyEmail('', this.otpValue));
      this.step.set('success');
    } catch (e: any) {
      this.errorMsg.set(
        e?.error?.error?.message || 'Invalid OTP. Please try again.'
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  async resendOtp() {
    if (this.resendTimer() > 0) return;
    this.isLoading.set(true);
    try {
      await firstValueFrom(this.auth.resendOtp(this.email()));
      this.startResendTimer();
      this.otpDigits.set(['', '', '', '', '', '']);
    } finally {
      this.isLoading.set(false);
    }
  }

  goToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
