import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AsyncValidatorFn,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RegisterStore } from '../register.store';
import { InputControlComponent } from '@shared/components/input-control';
import { SelectControlComponent } from '@shared/components/select-control';

@Component({
  selector: 'app-step-3-basic-info',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputControlComponent, SelectControlComponent],
  templateUrl: './step-3-basic-info.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step3BasicInfoComponent implements OnInit {
  readonly store = inject(RegisterStore);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    displayName: ['', [Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email], [this.emailAvailableValidator()]],
    mobile: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-()]{7,20}$/)]],
    country: ['', [Validators.required]],
    timezone: ['UTC', [Validators.required]],
    language: ['en', [Validators.required]],
    gender: ['', [Validators.required]],
  });

  private emailAvailableValidator(): AsyncValidatorFn {
    return async (control) => {
      const value = String(control.value ?? '').trim().toLowerCase();
      if (!value || control.errors?.['email'] || control.errors?.['required']) return null;
      if (this.store.emailVerified() && value === this.store.email()?.toLowerCase()) return null;
      const available = await this.store.checkEmailAvailability(value);
      return available ? null : { emailTaken: true };
    };
  }

  ngOnInit() {
    const s = this.store;
    this.form.patchValue({
      firstName: s.firstName(),
      lastName: s.lastName(),
      displayName: s.displayName(),
      email: s.email(),
      mobile: s.mobile(),
      country: s.country(),
      timezone: this.detectTimezone(s.timezone()),
      language: s.language(),
      gender: s.gender(),
    });
  }

  private detectTimezone(current: string): string {
    if (current && current !== 'UTC') return current;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz && tz !== 'Etc/UTC' ? tz : 'UTC';
    } catch {
      return 'UTC';
    }
  }

  emailPending(): boolean {
    return this.form.get('email')?.status === 'PENDING';
  }

  onSubmit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.form.pending) return;
    const v = this.form.getRawValue();
    this.store.updatePersonalInfo({
      firstName: v.firstName,
      lastName: v.lastName,
      displayName: v.displayName,
      email: v.email,
      mobile: v.mobile,
      country: v.country,
      timezone: v.timezone,
      language: v.language,
      gender: v.gender,
    });
    this.store.nextStep();
    this.store.syncProgressToBackend();
  }
}
