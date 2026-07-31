import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['../../auth-shell.css', './forgot-password.component.css'],
})
export class ForgotPasswordComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  step = signal<1 | 2>(1);
  isLoading = signal<boolean>(false);
  errorMsg = signal<string>('');
  resendTimer = signal<number>(0);
  private timerInterval: any;

  emailForm!: FormGroup;

  ngOnInit() {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]]
    });
  }

  ngOnDestroy() {
    clearInterval(this.timerInterval);
  }

  private startResendTimer() {
    this.resendTimer.set(60);
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.resendTimer() > 0) {
        this.resendTimer.update(t => t - 1);
      } else {
        clearInterval(this.timerInterval);
      }
    }, 1000);
  }

  async sendResetEmail() {
    if (this.emailForm.invalid) return;
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      const clientCode = sessionStorage.getItem('zcc.clientCode') || '';
      await this.auth.forgotPassword({
        clientCode,
        email: this.emailForm.value.email
      }).toPromise();
      this.step.set(2);
      this.startResendTimer();
    } catch (e: any) {
      this.errorMsg.set(e?.error?.error?.message || 'Failed to send reset email. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async resendEmail() {
    if (this.resendTimer() > 0) return;
    this.isLoading.set(true);
    try {
      const clientCode = sessionStorage.getItem('zcc.clientCode') || '';
      await this.auth.forgotPassword({
        clientCode,
        email: this.emailForm.value.email
      }).toPromise();
      this.startResendTimer();
    } finally {
      this.isLoading.set(false);
    }
  }

  goToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
