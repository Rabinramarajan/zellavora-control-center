import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, ValidatorFn } from '@angular/forms';
import { RegisterStore } from '../register.store';
import { PasswordStrengthComponent } from '../../../../../shared/components/password-strength.component';

@Component({
  selector: 'app-step-8-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PasswordStrengthComponent],
  templateUrl: './step-8-password.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step8PasswordComponent implements OnInit {
  readonly store = inject(RegisterStore);
  private readonly fb = inject(FormBuilder);

  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(12)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [this.confirmMatchValidator(), this.noPersonalInfoValidator()] }
  );

  private confirmMatchValidator(): ValidatorFn {
    return (control) =>
      control.value && control.value.password === control.value.confirmPassword
        ? null
        : { passwordMismatch: true };
  }

  private noPersonalInfoValidator(): ValidatorFn {
    return (control) => {
      const pw = control.value?.password;
      if (!pw) return null;
      const parts = [
        this.store.email()?.split('@')[0],
        this.store.firstName(),
        this.store.lastName(),
      ]
        .map((p) => p?.trim())
        .filter((p) => !!p && p.length >= 3);
      const lower = String(pw).toLowerCase();
      const hit = parts.some((p) => lower.includes(String(p).toLowerCase()));
      return hit ? { containsPersonalInfo: true } : null;
    };
  }

  ngOnInit() {
    const s = this.store;
    this.form.patchValue({
      password: s.password(),
      confirmPassword: s.confirmPassword(),
    });
  }

  showError(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  errorMessage(field: string): string {
    const control = this.form.get(field);
    if (!control || !control.errors) return '';
    const errors = control.errors;
    if (errors['required']) return 'This field is required.';
    if (errors['minlength']) {
      return `Must be at least ${errors['minlength'].requiredLength} characters.`;
    }
    return 'Please fix this field.';
  }

  passwordMismatch(): boolean {
    return !!this.form.errors?.['passwordMismatch'] && this.form.touched;
  }

  containsPersonalInfo(): boolean {
    return !!this.form.errors?.['containsPersonalInfo'] && this.form.touched;
  }

  onSubmit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.store.updatePassword({
      password: v.password,
      confirmPassword: v.confirmPassword,
    });
    this.store.nextStep();
    this.store.syncProgressToBackend();
  }
}
