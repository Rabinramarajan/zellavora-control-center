import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormField, FormRoot, apply, form, pattern } from '@angular/forms/signals';
import {
  FormInputControl,
  SelectControl,
  SelectControlOption,
  formInputControlSchema,
  selectFieldSchema,
  textFieldSchema,
} from '@zellavoras/ui';
import { RegisterStore } from '../register.store';
import { DragDropUploadComponent } from '../../../../../shared/components/drag-drop-upload.component';
import { stringsToOptions } from '@shared/utils/select-options';
import { FORM_PATTERNS } from '@shared/utils/form-patterns';
import { validateAvailability } from '@shared/utils/validate-availability';

interface UseCaseOption {
  value: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-step-6-organization',
  standalone: true,
  imports: [
    CommonModule,
    FormField,
    FormRoot,
    DragDropUploadComponent,
    FormInputControl,
    SelectControl,
  ],
  templateUrl: './step-6-organization.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step6OrganizationComponent {
  readonly store = inject(RegisterStore);
  readonly selectedUseCases = signal<string[]>(this.store.useCases());

  readonly useCaseOptions: UseCaseOption[] = [
    { value: 'project-management', label: 'Project Management', icon: 'kanban' },
    { value: 'crm', label: 'CRM', icon: 'users' },
    { value: 'analytics', label: 'Analytics', icon: 'chart' },
    { value: 'hr-management', label: 'HR Management', icon: 'briefcase' },
    { value: 'other', label: 'Other', icon: 'grid' },
  ];

  readonly industryOptions: SelectControlOption[] = stringsToOptions([
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
  ]);

  readonly organizationSizeOptions: SelectControlOption[] = [
    { value: '1-10', label: '1–10' },
    { value: '10-50', label: '10–50' },
    { value: '50-100', label: '50–100' },
    { value: '100-500', label: '100–500' },
    { value: '500+', label: '500+' },
  ];

  readonly currencyOptions: SelectControlOption[] = [
    { value: 'USD', label: 'USD – US Dollar ($)' },
    { value: 'EUR', label: 'EUR – Euro (€)' },
    { value: 'GBP', label: 'GBP – British Pound (£)' },
    { value: 'INR', label: 'INR – Indian Rupee (₹)' },
    { value: 'JPY', label: 'JPY – Japanese Yen (¥)' },
    { value: 'AUD', label: 'AUD – Australian Dollar (A$)' },
    { value: 'CAD', label: 'CAD – Canadian Dollar (C$)' },
    { value: 'SGD', label: 'SGD – Singapore Dollar (S$)' },
    { value: 'AED', label: 'AED – UAE Dirham (د.إ)' },
    { value: 'Other', label: 'Other' },
  ];

  readonly fiscalYearOptions: SelectControlOption[] = [
    { value: 'january-december', label: 'January – December' },
    { value: 'april-march', label: 'April – March' },
    { value: 'july-june', label: 'July – June' },
    { value: 'october-september', label: 'October – September' },
  ];

  readonly timezoneOptions: SelectControlOption[] = stringsToOptions([
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
  ]);

  readonly icons: Record<string, string> = {
    kanban: 'M12 3v12 M5 3v18 M19 3v8 M3 21h18',
    users:
      'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    chart: 'M18 20V10 M12 20V4 M6 20v-6',
    briefcase: 'M3 7h18v13H3z M8 7V4h8v3 M8 10v2 M16 10v2',
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  };

  private readonly model = signal({
    organizationName: this.store.organizationName(),
    organizationCode: this.store.organizationCode(),
    industry: this.store.industry(),
    organizationSize: this.store.organizationSize() || '10-50',
    website: this.store.website(),
    gstNumber: this.store.gstNumber(),
    taxNumber: this.store.taxNumber(),
    currency: this.store.currency() || 'USD',
    fiscalYear: this.store.fiscalYear() || 'january-december',
    timezone: this.detectTimezone(this.store.timezone()),
  });

  readonly form = form(
    this.model,
    (path) => {
      apply(path.organizationName, textFieldSchema({ minLength: 3, maxLength: 100 }));
      validateAvailability(path.organizationName, {
        check: (name) => this.store.checkOrgNameAvailability(name),
        skip: (name) =>
          name.length < 3 || name.toLowerCase() === this.store.organizationName()?.toLowerCase(),
        message: 'This organization name is already registered.',
      });
      apply(
        path.organizationCode,
        formInputControlSchema({
          required: { message: 'Organization code is required.' },
          pattern: {
            value: /^[a-zA-Z0-9-]{2,16}$/,
            message: '2–16 characters: letters, numbers, hyphens only.',
          },
        })
      );
      validateAvailability(path.organizationCode, {
        check: (code) => this.store.checkOrgCodeAvailability(code),
        skip: (code) => code.toLowerCase() === this.store.organizationCode()?.toLowerCase(),
        message: 'This organization code is taken.',
      });
      apply(path.industry, selectFieldSchema({ message: 'Select an industry.' }));
      apply(path.organizationSize, selectFieldSchema({ message: 'Select a company size.' }));
      apply(path.currency, selectFieldSchema({ message: 'Select a base currency.' }));
      apply(path.fiscalYear, selectFieldSchema({ message: 'Select a fiscal year.' }));
      apply(path.timezone, selectFieldSchema({ message: 'Select a timezone.' }));
      pattern(path.website, FORM_PATTERNS.url, {
        message: 'Enter a full URL, e.g. https://example.com',
      });
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

  generateCodeFromName() {
    const slug = this.form
      .organizationName()
      .value()
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 16);
    if (slug) {
      this.form.organizationCode().value.set(slug);
      this.form.organizationCode().markAsDirty();
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

  onLogoUploaded(logoBase64: string) {
    this.store.updateOrganizationInfo({ logoUrl: logoBase64 });
  }

  private save(): undefined {
    this.store.updateOrganizationInfo({ ...this.model(), useCases: this.selectedUseCases() });
    this.store.nextStep();
    this.store.syncProgressToBackend();
    return undefined;
  }
}
