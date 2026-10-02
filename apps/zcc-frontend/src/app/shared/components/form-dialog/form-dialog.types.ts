import { DialogSize } from '../dialog';

export type FormDialogMode = 'create' | 'edit' | 'view';

export type FormFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'number'
  | 'password'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'textarea'
  | 'toggle'
  | 'checkbox';

export type FormFieldValue = string | number | boolean | string[] | null;
export type FormDialogValues = Record<string, FormFieldValue>;

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormFieldDef {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  /** Helper text under the field; replaced by the error message while invalid. */
  hint?: string;
  options?: readonly FormFieldOption[];
  /** Columns spanned in the two-column grid; `2` makes the field full width. */
  span?: 1 | 2;
  /** PrimeIcons class shown inside the input, e.g. `pi pi-envelope`. Defaults by type. */
  icon?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: { regex: RegExp; message: string };
  /** Always read-only, even in create/edit mode (e.g. server-generated values). */
  readonly?: boolean;
  /** Text next to a toggle or checkbox. */
  inlineLabel?: string;
  /** Render the value as a coloured status chip in view mode. */
  displayAs?: 'status';
  rows?: number;
}

export interface FormSectionDef {
  title: string;
  fields: readonly FormFieldDef[];
}

export interface FormDialogConfig<R = unknown> {
  mode: FormDialogMode;
  /** Titles per mode; `view` falls back to the edit title when switching to edit. */
  title: Partial<Record<FormDialogMode, string>>;
  subtitle?: Partial<Record<FormDialogMode, string>>;
  /** Small badge shown next to the title, e.g. a generated code. */
  badge?: string;
  sections: readonly FormSectionDef[];
  value?: FormDialogValues;
  submitText?: Partial<Record<'create' | 'edit', string>>;
  /** Shows an Edit button in view mode that switches the dialog to edit mode in place. */
  canEdit?: boolean;
  /** Ask before discarding unsaved changes. Defaults to true. */
  confirmDiscard?: boolean;
  /** Persists the values; a thrown error is shown inline and keeps the dialog open. */
  save: (values: FormDialogValues, mode: 'create' | 'edit') => Promise<R>;
}

export interface FormDialogOpenOptions {
  size?: DialogSize;
}
