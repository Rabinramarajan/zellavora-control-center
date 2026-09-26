import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormField, FormRoot, apply, form, maxLength } from '@angular/forms/signals';
import {
  FormInputControl,
  SelectControl,
  emailFieldSchema,
  formInputControlSchema,
  selectFieldSchema,
  textFieldSchema,
} from '@zellavoras/ui';
import { RegisterStore } from '../register.store';
import { ddlToOptions, stringsToOptions } from '@shared/utils/select-options';
import { FORM_PATTERNS } from '@shared/utils/form-patterns';
import { validateAvailability } from '@shared/utils/validate-availability';

@Component({
  selector: 'app-step-3-basic-info',
  standalone: true,
  imports: [CommonModule, FormField, FormRoot, FormInputControl, SelectControl],
  templateUrl: './step-3-basic-info.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step3BasicInfoComponent {
  readonly store = inject(RegisterStore);

  readonly countryOptions = computed(() => stringsToOptions(this.store.countryOptions()));
  readonly languageOptions = computed(() => ddlToOptions(this.store.languageOptions()));
  readonly genderOptions = computed(() => ddlToOptions(this.store.genderOptions()));

  private readonly model = signal({
    firstName: this.store.firstName(),
    lastName: this.store.lastName(),
    displayName: this.store.displayName(),
    email: this.store.email(),
    mobile: this.store.mobile(),
    country: this.store.country(),
    timezone: this.detectTimezone(this.store.timezone()),
    language: this.store.language() || 'en',
    gender: this.store.gender(),
  });

  readonly form = form(
    this.model,
    (path) => {
      apply(path.firstName, textFieldSchema({ minLength: 2, maxLength: 50 }));
      apply(path.lastName, textFieldSchema({ minLength: 2, maxLength: 50 }));
      maxLength(path.displayName, 100);
      apply(path.email, emailFieldSchema());
      validateAvailability(path.email, {
        check: (email) => this.store.checkEmailAvailability(email.toLowerCase()),
        // A verified address belongs to this registration already.
        skip: (email) =>
          this.store.emailVerified() && email.toLowerCase() === this.store.email()?.toLowerCase(),
        message: 'This email is already registered.',
      });
      apply(
        path.mobile,
        formInputControlSchema({
          required: { message: 'Mobile number is required.' },
          pattern: { value: FORM_PATTERNS.phone, message: 'Enter a valid phone number.' },
        })
      );
      apply(path.country, selectFieldSchema({ message: 'Select your country.' }));
      apply(path.language, selectFieldSchema({ message: 'Select a language.' }));
      apply(path.gender, selectFieldSchema({ message: 'Select a gender.' }));
    },
    { submission: { action: async () => this.save() } }
  );

  private detectTimezone(current: string): string {
    if (current && current !== 'UTC') return current;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz && tz !== 'Etc/UTC' ? tz : 'UTC';
    } catch {
      return 'UTC';
    }
  }

  private save(): undefined {
    this.store.updatePersonalInfo(this.model());
    this.store.nextStep();
    this.store.syncProgressToBackend();
    return undefined;
  }
}
