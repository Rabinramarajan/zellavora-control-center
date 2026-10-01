import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  DialogShellComponent,
  injectDialogData,
  injectDialogRef,
} from '../../../shared/components/dialog';
import { errorMessage } from './iam-feedback.service';
import { IAM_INPUT } from './iam-page-header.component';

export type FormValue = string | number | boolean | null;
export type FormValues = Record<string, FormValue>;

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'textarea' | 'number' | 'select' | 'toggle';
  value?: FormValue;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: FormFieldOption[];
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: { regex: RegExp; message: string };
  disabled?: boolean;
  /** Hide the field unless this returns true for the current values. */
  visibleWhen?: (values: FormValues) => boolean;
}

export interface FormDialogData {
  title: string;
  description?: string;
  submitText?: string;
  variant?: 'primary' | 'danger';
  fields: FormField[];
  /** Runs on submit; a thrown error is shown inline and keeps the dialog open. */
  submit: (values: FormValues) => Promise<unknown>;
}

let nextId = 0;

/**
 * Schema-driven form dialog for IAM create/edit flows. Closes with the
 * submitted values only after `submit` resolves, so server-side validation
 * (409 duplicates, 400 policy errors) is shown in place.
 */
@Component({
  selector: 'zcc-iam-form-dialog',
  standalone: true,
  imports: [DialogShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './iam-form-dialog.component.html',
  styleUrl: './iam-form-dialog.component.scss',
})
export class IamFormDialogComponent {
  protected readonly data = injectDialogData<FormDialogData>();
  protected readonly ref = injectDialogRef<FormValues | null>();
  protected readonly inputClass = IAM_INPUT;
  protected readonly formId = `zcc-iam-form-${nextId++}`;

  protected readonly values = signal<FormValues>(
    Object.fromEntries(
      this.data.fields.map((f) => [f.key, f.value ?? (f.type === 'toggle' ? false : null)])
    )
  );
  protected readonly touched = signal<ReadonlySet<string>>(new Set());
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly visibleFields = computed(() =>
    this.data.fields.filter((f) => !f.visibleWhen || f.visibleWhen(this.values()))
  );

  protected readonly errors = computed<Record<string, string | null>>(() => {
    const values = this.values();
    return Object.fromEntries(
      this.visibleFields().map((f) => [f.key, this.validate(f, values[f.key])])
    );
  });

  protected inputId(field: FormField): string {
    return `${this.formId}-${field.key}`;
  }

  protected describedBy(field: FormField): string | null {
    if (this.visibleError(field.key)) return `${this.inputId(field)}-err`;
    return field.hint ? `${this.inputId(field)}-hint` : null;
  }

  protected visibleError(key: string): string | null {
    return this.submitted() || this.touched().has(key) ? (this.errors()[key] ?? null) : null;
  }

  protected set(key: string, value: FormValue): void {
    this.values.update((v) => ({ ...v, [key]: value }));
    this.serverError.set(null);
  }

  protected setInput(field: FormField, raw: string): void {
    if (field.type === 'number') {
      this.set(field.key, raw === '' ? null : Number(raw));
    } else {
      this.set(field.key, raw);
    }
  }

  protected touch(key: string): void {
    this.touched.update((t) => new Set(t).add(key));
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    if (Object.values(this.errors()).some(Boolean) || this.saving()) return;

    const visible = new Set(this.visibleFields().map((f) => f.key));
    const payload = Object.fromEntries(
      Object.entries(this.values())
        .filter(([key]) => visible.has(key))
        .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
    );

    this.saving.set(true);
    this.serverError.set(null);
    try {
      await this.data.submit(payload);
      this.ref.close(payload);
    } catch (err) {
      this.serverError.set(errorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  private validate(field: FormField, value: FormValue): string | null {
    const text = typeof value === 'string' ? value.trim() : value;
    const empty = text === null || text === undefined || text === '';
    if (field.required && empty) return `${field.label} is required.`;
    if (empty) return null;
    if (field.type === 'number') {
      const n = Number(text);
      if (!Number.isInteger(n)) return 'Enter a whole number.';
      if (field.min !== undefined && n < field.min) return `Must be at least ${field.min}.`;
      if (field.max !== undefined && n > field.max) return `Must be at most ${field.max}.`;
    }
    if (typeof text === 'string') {
      if (field.maxLength && text.length > field.maxLength) {
        return `Use at most ${field.maxLength} characters.`;
      }
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        return 'Enter a valid email address.';
      }
      if (field.pattern && !field.pattern.regex.test(text)) return field.pattern.message;
    }
    return null;
  }
}
