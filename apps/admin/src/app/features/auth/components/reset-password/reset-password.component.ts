import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormField, FormRoot, apply, form, required, validate } from '@angular/forms/signals';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormInputControl, passwordFieldSchema } from '@zellavoras/ui';
import { AuthService } from '@core/auth/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormField, FormRoot, FormInputControl, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrls: ['../../auth-shell.css', './reset-password.component.css'],
})
export class ResetPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly token = signal(this.route.snapshot.queryParamMap.get('token') || '');
  readonly step = signal<'form' | 'success' | 'invalid'>(this.token() ? 'form' : 'invalid');
  readonly isLoading = signal(false);
  readonly errorMsg = signal('');
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  private readonly model = signal({ newPassword: '', confirmPassword: '' });

  readonly form = form(
    this.model,
    (path) => {
      apply(path.newPassword, passwordFieldSchema({ minLength: 12 }));
      required(path.confirmPassword, { message: 'Confirm your new password.' });
      validate(path.confirmPassword, ({ value, valueOf }) =>
        value() && value() !== valueOf(path.newPassword)
          ? { kind: 'mismatch', message: 'Passwords do not match.' }
          : undefined
      );
    },
    { submission: { action: async () => this.submit() } }
  );

  private readonly password = computed(() => this.form.newPassword().value());

  readonly hasMinLength = computed(() => this.password().length >= 12);
  readonly hasUppercase = computed(() => /[A-Z]/.test(this.password()));
  readonly hasLowercase = computed(() => /[a-z]/.test(this.password()));
  readonly hasNumber = computed(() => /[0-9]/.test(this.password()));
  readonly hasSpecial = computed(() => /[^a-zA-Z0-9]/.test(this.password()));

  readonly passwordStrength = computed(() => {
    const v = this.password();
    let score = 0;
    if (v.length >= 8) score++;
    if (v.length >= 12) score++;
    if (this.hasUppercase() && this.hasLowercase()) score++;
    if (this.hasNumber() && this.hasSpecial()) score++;
    return score;
  });

  readonly strengthLabel = computed(
    () => ['', 'Weak', 'Fair', 'Good', 'Strong'][this.passwordStrength()] || ''
  );
  readonly strengthColor = computed(
    () => ['', '#ef4444', '#f59e0b', '#22c55e', '#10b981'][this.passwordStrength()] || ''
  );

  private async submit(): Promise<undefined> {
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      await firstValueFrom(
        this.auth.resetPassword({ token: this.token(), newPassword: this.model().newPassword })
      );
      this.step.set('success');
    } catch (e: any) {
      this.errorMsg.set(
        e?.error?.error?.message || 'Failed to reset password. The link may have expired.'
      );
    } finally {
      this.isLoading.set(false);
    }
    return undefined;
  }

  goToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
