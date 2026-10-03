import { FormFieldDef, FormFieldValue } from './form-dialog.types';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+()\s-]*$/;

const isEmptyValue = (value: FormFieldValue | undefined): boolean =>
  value === null ||
  value === undefined ||
  value === false ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

/** Returns the first failing rule's message, or null when the value is valid. */
export const validateField = (
  field: FormFieldDef,
  value: FormFieldValue | undefined
): string | null => {
  if (field.readonly) return null;
  if (isEmptyValue(value)) {
    if (!field.required) return null;
    return field.type === 'checkbox'
      ? `${field.label} must be accepted.`
      : `${field.label} is required.`;
  }

  if (typeof value === 'string') {
    const text = value.trim();
    if (field.minLength && text.length < field.minLength) {
      return `${field.label} must be at least ${field.minLength} characters.`;
    }
    if (field.maxLength && text.length > field.maxLength) {
      return `${field.label} must be at most ${field.maxLength} characters.`;
    }
    if (field.type === 'email' && !EMAIL.test(text)) return 'Enter a valid email address.';
    if (field.type === 'tel' && !PHONE.test(text)) return 'Use digits, spaces or + ( ) -.';
    if (field.pattern && !field.pattern.regex.test(text)) return field.pattern.message;
  }

  if (field.type === 'number') {
    const n = Number(value);
    if (Number.isNaN(n)) return `${field.label} must be a number.`;
    if (field.min !== undefined && n < field.min)
      return `${field.label} must be at least ${field.min}.`;
    if (field.max !== undefined && n > field.max)
      return `${field.label} must be at most ${field.max}.`;
  }
  return null;
};

/** Normalised value used for dirty checks and the saved payload. */
export const normaliseValue = (
  field: FormFieldDef,
  value: FormFieldValue | undefined
): FormFieldValue => {
  switch (field.type) {
    case 'toggle':
    case 'checkbox':
      return value === true;
    case 'multiselect':
      return Array.isArray(value) ? [...value] : [];
    case 'number':
      return isEmptyValue(value) ? null : Number(value);
    default:
      return typeof value === 'string' ? value.trim() || null : (value ?? null);
  }
};
