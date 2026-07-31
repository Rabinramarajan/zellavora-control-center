import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AsyncValidatorFn,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RegisterStore } from '../register.store';
import { DragDropUploadComponent } from '../../../../../shared/components/drag-drop-upload.component';

interface UseCaseOption {
  value: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-step-6-organization',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DragDropUploadComponent],
  templateUrl: './step-6-organization.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step6OrganizationComponent implements OnInit {
  readonly store = inject(RegisterStore);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    organizationName: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(100)],
      [this.orgNameAvailableValidator()],
    ],
    organizationCode: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9-]{2,16}$/)]],
    industry: ['', [Validators.required]],
    organizationSize: ['10-50', [Validators.required]],
    website: [''],
    gstNumber: [''],
    taxNumber: [''],
    currency: ['USD', [Validators.required]],
    fiscalYear: ['january-december', [Validators.required]],
    timezone: ['UTC', [Validators.required]],
  });

  readonly selectedUseCases = signal<string[]>([]);

  readonly useCaseOptions: UseCaseOption[] = [
    { value: 'project-management', label: 'Project Management', icon: 'kanban' },
    { value: 'crm', label: 'CRM', icon: 'users' },
    { value: 'analytics', label: 'Analytics', icon: 'chart' },
    { value: 'hr-management', label: 'HR Management', icon: 'briefcase' },
    { value: 'other', label: 'Other', icon: 'grid' },
  ];

  readonly industryOptions = [
    'Healthcare',
    'Banking',
    'Technology',
    'Retail',
    'Finance',
    'Manufacturing',
    'Education',
    'Real Estate',
    'Logistics',
    'Other',
  ];

  readonly currencyOptions: { key: string; value: string }[] = [
    { key: 'USD', value: 'USD – US Dollar ($)' },
    { key: 'EUR', value: 'EUR – Euro (€)' },
    { key: 'GBP', value: 'GBP – British Pound (£)' },
    { key: 'INR', value: 'INR – Indian Rupee (₹)' },
    { key: 'JPY', value: 'JPY – Japanese Yen (¥)' },
    { key: 'AUD', value: 'AUD – Australian Dollar (A$)' },
    { key: 'CAD', value: 'CAD – Canadian Dollar (C$)' },
    { key: 'SGD', value: 'SGD – Singapore Dollar (S$)' },
    { key: 'AED', value: 'AED – UAE Dirham (د.إ)' },
    { key: 'Other', value: 'Other' },
  ];

  readonly fiscalYearOptions: { key: string; value: string }[] = [
    { key: 'january-december', value: 'January – December' },
    { key: 'april-march', value: 'April – March' },
    { key: 'july-june', value: 'July – June' },
    { key: 'october-september', value: 'October – September' },
  ];

  readonly timezoneOptions: string[] = [
    'UTC',
    'Etc/GMT+12',
    'Pacific/Auckland',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Asia/Kolkata',
    'Asia/Dubai',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Sao_Paulo',
  ];

  readonly icons: Record<string, string> = {
    kanban: 'M12 3v12 M5 3v18 M19 3v8 M3 21h18',
    users:
      'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    chart: 'M18 20V10 M12 20V4 M6 20v-6',
    briefcase: 'M3 7h18v13H3z M8 7V4h8v3 M8 10v2 M16 10v2',
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  };

  private orgNameAvailableValidator(): AsyncValidatorFn {
    return async (control) => {
      const value = String(control.value ?? '').trim();
      if (!value || value.length < 3) return null;
      if (value.toLowerCase() === this.store.organizationName()?.toLowerCase()) return null;
      const available = await this.store.checkOrgNameAvailability(value);
      return available ? null : { orgNameTaken: true };
    };
  }

  ngOnInit() {
    const s = this.store;
    this.form.patchValue({
      organizationName: s.organizationName(),
      organizationCode: s.organizationCode(),
      industry: s.industry(),
      organizationSize: s.organizationSize(),
      website: s.website(),
      gstNumber: s.gstNumber(),
      taxNumber: s.taxNumber(),
      currency: s.currency(),
      fiscalYear: s.fiscalYear(),
      timezone: this.detectTimezone(s.timezone()),
    });
    this.selectedUseCases.set(s.useCases());
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

  generateCodeFromName() {
    const name = String(this.form.get('organizationName')?.value ?? '');
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 16);
    if (slug) {
      this.form.get('organizationCode')?.setValue(slug);
      this.form.get('organizationCode')?.markAsDirty();
    }
  }

  isUseCaseSelected(value: string): boolean {
    return this.selectedUseCases().includes(value);
  }

  toggleUseCase(value: string) {
    this.selectedUseCases.update((list) =>
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    );
  }

  showError(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  orgNamePending(): boolean {
    return this.form.get('organizationName')?.status === 'PENDING';
  }

  errorMessage(field: string): string {
    const control = this.form.get(field);
    if (!control || !control.errors) return '';
    const errors = control.errors;
    if (errors['required']) return 'This field is required.';
    if (errors['pattern']) return 'Use 2–16 characters: letters, numbers, hyphens only.';
    if (errors['minlength']) {
      return `Must be at least ${errors['minlength'].requiredLength} characters.`;
    }
    if (errors['maxlength']) {
      return `Must be at most ${errors['maxlength'].requiredLength} characters.`;
    }
    return 'Please fix this field.';
  }

  async checkOrgCode() {
    const code = this.form?.value?.organizationCode;
    if (code) {
      await this.store.checkOrgCodeAvailability(code);
    }
  }

  onLogoUploaded(logoBase64: string) {
    this.store.updateOrganizationInfo({ logoUrl: logoBase64 });
  }

  onSubmit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.form.pending) return;
    const v = this.form.getRawValue();
    this.store.updateOrganizationInfo({
      organizationName: v.organizationName,
      organizationCode: v.organizationCode,
      industry: v.industry,
      organizationSize: v.organizationSize,
      website: v.website,
      gstNumber: v.gstNumber,
      taxNumber: v.taxNumber,
      useCases: this.selectedUseCases(),
      currency: v.currency,
      fiscalYear: v.fiscalYear,
      timezone: v.timezone,
    });
    this.store.nextStep();
    this.store.syncProgressToBackend();
  }
}
