import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormField, FormRoot, apply, form, required, validate } from '@angular/forms/signals';
import { FormInputControl, passwordFieldSchema } from '@zellavoras/ui';
import { RegisterStore } from '../register.store';
import { PasswordStrengthComponent } from '../../../../../shared/components/password-strength.component';

@Component({
  selector: 'app-step-8-password',
  standalone: true,
  imports: [CommonModule, FormField, FormRoot, PasswordStrengthComponent, FormInputControl],
  templateUrl: './step-8-password.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step8PasswordComponent {
  readonly store = inject(RegisterStore);

  private readonly model = signal({
    password: this.store.password(),
    confirmPassword: this.store.confirmPassword(),
  });

  readonly form = form(
    this.model,
    (path) => {
      apply(path.password, passwordFieldSchema({ minLength: 12 }));
      validate(path.password, ({ value }) =>
        this.containsPersonalInfo(value())
          ? { kind: 'personalInfo', message: 'Password cannot contain your name or email.' }
          : undefined
      );
      required(path.confirmPassword, { message: 'Confirm your password.' });
      validate(path.confirmPassword, ({ value, valueOf }) =>
        value() && value() !== valueOf(path.password)
          ? { kind: 'mismatch', message: 'Passwords do not match.' }
          : undefined
      );
    },
    { submission: { action: async () => this.save() } }
  );

  private containsPersonalInfo(password: string): boolean {
    if (!password) return false;
    const lower = password.toLowerCase();
    return [this.store.email()?.split('@')[0], this.store.firstName(), this.store.lastName()]
      .map((part) => part?.trim().toLowerCase())
      .some((part) => !!part && part.length >= 3 && lower.includes(part));
  }

  private save(): undefined {
    this.store.updatePassword(this.model());
    this.store.nextStep();
    this.store.syncProgressToBackend();
    return undefined;
  }
}
