import { Component, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormField, FormRoot, apply, form, maxLength } from '@angular/forms/signals';
import { FormInputControl, emailFieldSchema } from '@zellavoras/ui';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormField, FormRoot, FormInputControl, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['../../auth-shell.css', './forgot-password.component.css'],
})
export class ForgotPasswordComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  step = signal<1 | 2>(1);
  isLoading = signal<boolean>(false);
  errorMsg = signal<string>('');
  resendTimer = signal<number>(0);
  private timerInterval: any;

  private readonly model = signal({ email: '' });

  readonly emailForm = form(
    this.model,
    (path) => {
      apply(path.email, emailFieldSchema());
      maxLength(path.email, 150);
    },
    { submission: { action: async () => this.sendResetEmail() } }
  );

  ngOnDestroy() {
    clearInterval(this.timerInterval);
  }

  private startResendTimer() {
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

  private async sendResetEmail(): Promise<undefined> {
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      const clientCode = sessionStorage.getItem('zcc.clientCode') || '';
      await firstValueFrom(
        this.auth.forgotPassword({
          clientCode,
          email: this.model().email,
        })
      );
      this.step.set(2);
      this.startResendTimer();
    } catch (e: any) {
      this.errorMsg.set(
        e?.error?.error?.message || 'Failed to send reset email. Please try again.'
      );
    } finally {
      this.isLoading.set(false);
    }
    return undefined;
  }

  async resendEmail() {
    if (this.resendTimer() > 0) return;
    this.isLoading.set(true);
    try {
      const clientCode = sessionStorage.getItem('zcc.clientCode') || '';
      await firstValueFrom(
        this.auth.forgotPassword({
          clientCode,
          email: this.model().email,
        })
      );
      this.startResendTimer();
    } finally {
      this.isLoading.set(false);
    }
  }

  goToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
