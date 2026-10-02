import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AppDialogService,
  APP_DIALOG_TITLE_ID,
  injectDialogData,
  injectDialogRef,
} from '../dialog';
import {
  FormDialogConfig,
  FormDialogMode,
  FormDialogValues,
  FormFieldDef,
  FormFieldValue,
} from './form-dialog.types';
import { normaliseValue, validateField } from './form-dialog.validation';

const MODE_ICON: Record<FormDialogMode, string> = {
  create: 'pi pi-plus',
  edit: 'pi pi-pencil',
  view: 'pi pi-eye',
};

const TYPE_ICON: Partial<Record<FormFieldDef['type'], string>> = {
  email: 'pi pi-envelope',
  tel: 'pi pi-phone',
  date: 'pi pi-calendar',
};

let nextId = 0;

const errorText = (err: unknown): string => {
  const message =
    (err as { error?: { message?: unknown }; message?: unknown } | null)?.error?.message ??
    (err as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message.trim()
    ? message
    : 'Something went wrong. Please try again.';
};

/**
 * Common create / edit / view dialog driven by a section + field config.
 * Open it through `FormDialogService` rather than directly.
 */
@Component({
  selector: 'app-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-dialog',
    '[attr.aria-busy]': 'saving() || null',
    '(keydown.escape)': 'onEscape($event)',
    '(document:click)': 'onDocumentClick($event)',
  },
  templateUrl: './form-dialog.component.html',
  styleUrl: './form-dialog.component.scss',
})
export class FormDialogComponent<R = unknown> {
  protected readonly config = injectDialogData<FormDialogConfig<R>>();
  private readonly ref = injectDialogRef<R | null>();
  private readonly dialogs = inject(AppDialogService);

  protected readonly titleId =
    inject(APP_DIALOG_TITLE_ID, { optional: true }) ?? `form-dialog-title-${nextId}`;
  protected readonly formId = `form-dialog-${nextId++}`;

  protected readonly mode = signal<FormDialogMode>(this.config.mode);
  protected readonly readOnly = computed(() => this.mode() === 'view');
  protected readonly fields = this.config.sections.flatMap((s) => s.fields);

  private initial = this.snapshot(this.config.value ?? {});
  protected readonly values = signal<FormDialogValues>({ ...this.initial });
  protected readonly touched = signal<ReadonlySet<string>>(new Set());
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly revealed = signal<ReadonlySet<string>>(new Set());
  protected readonly openMulti = signal<string | null>(null);

  protected readonly errors = computed(() => {
    const values = this.values();
    return Object.fromEntries(this.fields.map((f) => [f.key, validateField(f, values[f.key])]));
  });
  protected readonly valid = computed(() => Object.values(this.errors()).every((e) => !e));
  protected readonly dirty = computed(() => {
    const values = this.values();
    return this.fields.some(
      (f) =>
        JSON.stringify(normaliseValue(f, values[f.key])) !==
        JSON.stringify(normaliseValue(f, this.initial[f.key]))
    );
  });

  protected readonly title = computed(
    () => this.config.title[this.mode()] ?? this.config.title.edit ?? ''
  );
  protected readonly subtitle = computed(() => this.config.subtitle?.[this.mode()] ?? '');
  protected readonly headerIcon = computed(() => MODE_ICON[this.mode()]);
  protected readonly submitText = computed(() =>
    this.mode() === 'create'
      ? (this.config.submitText?.create ?? 'Create')
      : (this.config.submitText?.edit ?? 'Save Changes')
  );

  protected fieldId(field: FormFieldDef): string {
    return `${this.formId}-${field.key}`;
  }

  protected iconFor(field: FormFieldDef): string | null {
    return field.icon ?? TYPE_ICON[field.type] ?? null;
  }

  protected isLocked(field: FormFieldDef): boolean {
    return this.readOnly() || !!field.readonly;
  }

  protected visibleError(field: FormFieldDef): string | null {
    if (this.isLocked(field)) return null;
    return this.submitted() || this.touched().has(field.key) ? this.errors()[field.key] : null;
  }

  protected describedBy(field: FormFieldDef): string | null {
    if (this.visibleError(field)) return `${this.fieldId(field)}-err`;
    return field.hint ? `${this.fieldId(field)}-hint` : null;
  }

  protected text(field: FormFieldDef): string {
    const value = this.values()[field.key];
    return value === null || value === undefined ? '' : String(value);
  }

  protected list(field: FormFieldDef): string[] {
    const value = this.values()[field.key];
    return Array.isArray(value) ? value : [];
  }

  protected optionLabel(field: FormFieldDef, value: string): string {
    return field.options?.find((o) => o.value === value)?.label ?? value;
  }

  /** Human-readable value for view mode. */
  protected display(field: FormFieldDef): string {
    const value = this.values()[field.key];
    if (field.type === 'select') return value ? this.optionLabel(field, String(value)) : '—';
    if (field.type === 'toggle' || field.type === 'checkbox') return value ? 'Yes' : 'No';
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  }

  protected set(field: FormFieldDef, value: FormFieldValue): void {
    this.values.update((v) => ({ ...v, [field.key]: value }));
    this.serverError.set(null);
  }

  protected touch(field: FormFieldDef): void {
    this.touched.update((t) => new Set(t).add(field.key));
  }

  protected toggleOption(field: FormFieldDef, value: string): void {
    const current = this.list(field);
    this.set(
      field,
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    );
  }

  protected toggleMulti(field: FormFieldDef, event: Event): void {
    event.stopPropagation();
    this.openMulti.update((key) => (key === field.key ? null : field.key));
  }

  protected toggleReveal(field: FormFieldDef): void {
    this.revealed.update((r) => {
      const next = new Set(r);
      if (!next.delete(field.key)) next.add(field.key);
      return next;
    });
  }

  protected startEditing(): void {
    this.mode.set('edit');
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.openMulti()) return;
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.fd-multi')) this.openMulti.set(null);
  }

  protected onEscape(event: Event): void {
    event.stopPropagation();
    if (this.openMulti()) {
      this.openMulti.set(null);
      return;
    }
    void this.requestClose();
  }

  /** Closes the dialog, confirming first when there are unsaved edits. */
  protected async requestClose(): Promise<void> {
    if (this.saving()) return;
    if (!this.readOnly() && this.dirty() && this.config.confirmDiscard !== false) {
      const discard = await firstValueFrom(
        this.dialogs.confirm({
          title: 'Discard unsaved changes?',
          message: 'You have unsaved changes. Are you sure you want to discard them?',
          confirmText: 'Discard',
          cancelText: 'Keep Editing',
          variant: 'danger',
        })
      );
      if (!discard) return;
    }
    this.ref.close(null);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.readOnly() || this.saving()) return;
    this.submitted.set(true);
    if (!this.valid()) {
      const first = this.fields.find((f) => this.errors()[f.key]);
      if (first) queueMicrotask(() => document.getElementById(this.fieldId(first))?.focus());
      return;
    }
    this.saving.set(true);
    this.serverError.set(null);
    try {
      const mode = this.mode() === 'create' ? 'create' : 'edit';
      const result = await this.config.save(this.payload(), mode);
      this.ref.close(result);
    } catch (err) {
      this.serverError.set(errorText(err));
    } finally {
      this.saving.set(false);
    }
  }

  private payload(): FormDialogValues {
    const values = this.values();
    return Object.fromEntries(
      this.fields.filter((f) => !f.readonly).map((f) => [f.key, normaliseValue(f, values[f.key])])
    );
  }

  private snapshot(value: FormDialogValues): FormDialogValues {
    return Object.fromEntries(this.fields.map((f) => [f.key, value[f.key] ?? null]));
  }
}
