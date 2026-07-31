import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrls: ['../../auth-shell.css', './reset-password.component.css'],
})
export class ResetPasswordComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  step = signal<'form' | 'success' | 'invalid'>('form');
  isLoading = signal<boolean>(false);
  errorMsg = signal<string>('');
  showPassword = signal<boolean>(false);
  showConfirmPassword = signal<boolean>(false);
  token = signal<string>('');

  form!: FormGroup;

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!token) {
      this.step.set('invalid');
      return;
    }
    this.token.set(token);
    this.form = this.fb.group(
      {
        newPassword: ['', [Validators.required, Validators.minLength(12), this.passwordStrengthValidator]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator }
    );
  }

  passwordStrengthValidator(c: AbstractControl) {
    const v = c.value || '';
    const ok =
      /[A-Z]/.test(v) &&
      /[a-z]/.test(v) &&
      /[0-9]/.test(v) &&
      /[^a-zA-Z0-9]/.test(v) &&
      v.length >= 12;
    return ok ? null : { weakPassword: true };
  }

  passwordMatchValidator(g: AbstractControl) {
    return g.get('newPassword')?.value === g.get('confirmPassword')?.value
      ? null
      : { mismatch: true };
  }

  get passwordStrength(): number {
    const v = this.form?.get('newPassword')?.value || '';
    let score = 0;
    if (v.length >= 8) score++;
    if (v.length >= 12) score++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if (/[0-9]/.test(v) && /[^a-zA-Z0-9]/.test(v)) score++;
    return score;
  }

  get strengthLabel(): string {
    return ['', 'Weak', 'Fair', 'Good', 'Strong'][this.passwordStrength] || '';
  }

  get strengthColor(): string {
    return ['', '#ef4444', '#f59e0b', '#22c55e', '#10b981'][this.passwordStrength] || '';
  }

  /** Policy checklist helpers */
  get hasMinLength(): boolean {
    return (this.form?.get('newPassword')?.value || '').length >= 12;
  }
  get hasUppercase(): boolean {
    return /[A-Z]/.test(this.form?.get('newPassword')?.value || '');
  }
  get hasLowercase(): boolean {
    return /[a-z]/.test(this.form?.get('newPassword')?.value || '');
  }
  get hasNumber(): boolean {
    return /[0-9]/.test(this.form?.get('newPassword')?.value || '');
  }
  get hasSpecial(): boolean {
    return /[^a-zA-Z0-9]/.test(this.form?.get('newPassword')?.value || '');
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      await this.auth
        .resetPassword({ token: this.token(), newPassword: this.form.value.newPassword })
        .toPromise();
      this.step.set('success');
    } catch (e: any) {
      this.errorMsg.set(
        e?.error?.error?.message || 'Failed to reset password. The link may have expired.'
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  goToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
