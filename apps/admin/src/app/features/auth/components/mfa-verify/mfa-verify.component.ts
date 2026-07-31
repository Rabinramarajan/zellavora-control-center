import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-mfa-verify',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './mfa-verify.component.html',
  styleUrls: ['../../auth-shell.css', './mfa-verify.component.css'],
})
export class MfaVerifyComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  mode = signal<'totp' | 'backup'>('totp');
  isLoading = signal<boolean>(false);
  errorMsg = signal<string>('');
  rememberDevice = signal<boolean>(false);
  otpDigits = signal<string[]>(['', '', '', '', '', '']);
  mfaToken = signal<string>('');

  backupForm!: FormGroup;

  ngOnInit() {
    const token =
      this.route.snapshot.queryParamMap.get('mfaToken') ||
      sessionStorage.getItem('zcc.mfaToken') ||
      '';
    this.mfaToken.set(token);
    this.backupForm = this.fb.group({
      backupCode: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  ngOnDestroy() {
    // Cleanup if needed
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
    if (val && index < 5) document.getElementById(`mfa-otp-${index + 1}`)?.focus();
    if (digits.every((d) => d) && this.mode() === 'totp') {
      setTimeout(() => this.submitTotp(), 100);
    }
  }

  onOtpKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace' && !this.otpDigits()[index] && index > 0)
      document.getElementById(`mfa-otp-${index - 1}`)?.focus();
  }

  onOtpPaste(event: ClipboardEvent) {
    const pasted =
      event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) || '';
    if (pasted.length === 6) {
      this.otpDigits.set(pasted.split(''));
      event.preventDefault();
    }
  }

  async submitTotp() {
    if (this.otpValue.length !== 6) {
      this.errorMsg.set('Enter all 6 digits.');
      return;
    }
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      await this.auth
        .loginMfa({
          mfaToken: this.mfaToken(),
          code: this.otpValue,
          rememberMe: this.rememberDevice(),
        })
        .toPromise();
      sessionStorage.removeItem('zcc.mfaToken');
    } catch (e: any) {
      this.errorMsg.set(e?.error?.error?.message || 'Invalid code. Please try again.');
      this.otpDigits.set(['', '', '', '', '', '']);
      document.getElementById('mfa-otp-0')?.focus();
    } finally {
      this.isLoading.set(false);
    }
  }

  async submitBackup() {
    if (this.backupForm.invalid) return;
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      await this.auth
        .loginMfa({
          mfaToken: this.mfaToken(),
          code: this.backupForm.value.backupCode,
          rememberMe: this.rememberDevice(),
        })
        .toPromise();
      sessionStorage.removeItem('zcc.mfaToken');
    } catch (e: any) {
      this.errorMsg.set(e?.error?.error?.message || 'Invalid backup code.');
    } finally {
      this.isLoading.set(false);
    }
  }

  switchMode(m: 'totp' | 'backup') {
    this.mode.set(m);
    this.errorMsg.set('');
    this.otpDigits.set(['', '', '', '', '', '']);
  }

  goBack() {
    this.router.navigate(['/auth/login']);
  }
}
