import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { DialogShellComponent, injectDialogData, injectDialogRef } from '../../../shared/components/dialog';
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
  template: `
    <app-dialog-shell [title]="data.title" [closeResult]="null" [busy]="saving()">
      <form [id]="formId" class="space-y-4" novalidate (submit)="onSubmit($event)">
        @if (data.description) {
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ data.description }}</p>
        }
        @for (field of visibleFields(); track field.key) {
          <div>
            @if (field.type === 'toggle') {
              <label class="flex min-h-[44px] cursor-pointer items-center justify-between gap-4">
                <span class="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {{ field.label }}
                  @if (field.hint) {
                    <span
                      class="mt-0.5 block text-xs font-normal text-gray-500 dark:text-gray-400"
                      >{{ field.hint }}</span
                    >
                  }
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  class="size-5 shrink-0 accent-indigo-500"
                  [checked]="!!values()[field.key]"
                  [disabled]="field.disabled || saving()"
                  (change)="set(field.key, $any($event.target).checked)"
                />
              </label>
            } @else {
              <label
                [for]="inputId(field)"
                class="mb-1.5 block text-sm font-medium text-gray-800 dark:text-gray-200"
              >
                {{ field.label }}
                @if (field.required) {
                  <span class="text-red-500" aria-hidden="true">*</span>
                }
              </label>
              @switch (field.type) {
                @case ('textarea') {
                  <textarea
                    rows="4"
                    [id]="inputId(field)"
                    [class]="inputClass"
                    [placeholder]="field.placeholder ?? ''"
                    [attr.maxlength]="field.maxLength ?? null"
                    [attr.aria-invalid]="!!visibleError(field.key)"
                    [attr.aria-describedby]="describedBy(field)"
                    [disabled]="field.disabled || saving()"
                    [value]="values()[field.key] ?? ''"
                    (input)="set(field.key, $any($event.target).value)"
                    (blur)="touch(field.key)"
                  ></textarea>
                }
                @case ('select') {
                  <select
                    [id]="inputId(field)"
                    [class]="inputClass + ' min-h-[42px]'"
                    [attr.aria-invalid]="!!visibleError(field.key)"
                    [attr.aria-describedby]="describedBy(field)"
                    [disabled]="field.disabled || saving()"
                    (change)="set(field.key, $any($event.target).value || null)"
                    (blur)="touch(field.key)"
                  >
                    @if (!field.required) {
                      <option value="" [selected]="!values()[field.key]">
                        {{ field.placeholder ?? 'None' }}
                      </option>
                    }
                    @for (opt of field.options ?? []; track opt.value) {
                      <option [value]="opt.value" [selected]="values()[field.key] === opt.value">
                        {{ opt.label }}
                      </option>
                    }
                  </select>
                }
                @default {
                  <input
                    [id]="inputId(field)"
                    [type]="field.type"
                    [class]="inputClass + ' min-h-[42px]'"
                    [placeholder]="field.placeholder ?? ''"
                    [attr.min]="field.min ?? null"
                    [attr.max]="field.max ?? null"
                    [attr.maxlength]="field.maxLength ?? null"
                    [attr.autocomplete]="field.type === 'password' ? 'new-password' : 'off'"
                    [attr.aria-invalid]="!!visibleError(field.key)"
                    [attr.aria-describedby]="describedBy(field)"
                    [disabled]="field.disabled || saving()"
                    [value]="values()[field.key] ?? ''"
                    (input)="setInput(field, $any($event.target).value)"
                    (blur)="touch(field.key)"
                  />
                }
              }
              @if (visibleError(field.key); as err) {
                <p [id]="inputId(field) + '-err'" class="mt-1 text-xs text-red-500">{{ err }}</p>
              } @else if (field.hint) {
                <p
                  [id]="inputId(field) + '-hint'"
                  class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                >
                  {{ field.hint }}
                </p>
              }
            }
          </div>
        }
        @if (serverError()) {
          <div
            role="alert"
            class="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500"
          >
            {{ serverError() }}
          </div>
        }
      </form>

      <button
        dialogActions
        type="button"
        class="app-dialog-btn app-dialog-btn--ghost"
        [disabled]="saving()"
        (click)="ref.close(null)"
      >
        Cancel
      </button>
      <button
        dialogActions
        type="submit"
        [attr.form]="formId"
        [class]="'app-dialog-btn app-dialog-btn--' + (data.variant ?? 'primary')"
        [disabled]="saving()"
      >
        {{ saving() ? 'Saving…' : (data.submitText ?? 'Save') }}
      </button>
    </app-dialog-shell>
  `,
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
