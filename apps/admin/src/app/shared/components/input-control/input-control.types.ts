import { InjectionToken } from '@angular/core';
import { ValidationErrors } from '@angular/forms';

/**
 * Native input types supported by the control. `textarea` renders a
 * `<textarea>` element instead of an `<input>`.
 */
export type InputControlType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'tel'
  | 'url'
  | 'search'
  | 'date'
  | 'time'
  | 'datetime-local'
  | 'month'
  | 'week'
  | 'color'
  | 'textarea';

export type InputControlSize = 'sm' | 'md' | 'lg';

/** Resolves a single validation error into a human readable message. */
export type ValidationMessageFn = (error: any, label: string) => string;

export type ValidationMessageMap = Record<string, string | ValidationMessageFn>;

/**
 * Order in which validation errors are surfaced. The first matching key wins,
 * so a control that is both `required` and `minlength` shows `required`.
 */
export const VALIDATION_ERROR_PRIORITY: readonly string[] = [
  'required',
  'requiredTrue',
  'email',
  'min',
  'max',
  'minlength',
  'maxlength',
  'pattern',
];

export const DEFAULT_VALIDATION_MESSAGES: ValidationMessageMap = {
  required: (_e, label) => `${label} is required.`,
  requiredTrue: (_e, label) => `${label} must be accepted.`,
  email: () => `Enter a valid email address.`,
  min: (e) => `Value must be at least ${e?.min}.`,
  max: (e) => `Value must be at most ${e?.max}.`,
  minlength: (e) => `Use at least ${e?.requiredLength} characters.`,
  maxlength: (e) => `Use at most ${e?.requiredLength} characters.`,
  pattern: (_e, label) => `${label} has an invalid format.`,
};

/**
 * Application-wide message overrides. Provide in `app.config.ts` to localise
 * or reword messages without touching every usage site.
 */
export const INPUT_VALIDATION_MESSAGES = new InjectionToken<ValidationMessageMap>(
  'INPUT_VALIDATION_MESSAGES',
  { providedIn: 'root', factory: () => ({}) }
);

/**
 * Turns a control's `ValidationErrors` into a single message using the
 * priority order above, falling back to whichever key is present.
 */
export function resolveValidationMessage(
  errors: ValidationErrors | null,
  label: string,
  messages: ValidationMessageMap
): string | null {
  if (!errors) return null;

  const keys = Object.keys(errors);
  if (!keys.length) return null;

  const key =
    VALIDATION_ERROR_PRIORITY.find((candidate) => keys.includes(candidate)) ?? keys[0];
  const template = messages[key];

  if (typeof template === 'function') return template(errors[key], label);
  if (typeof template === 'string') return template;

  // A validator may return its own message, e.g. `{ serverError: 'Email taken' }`.
  const raw = errors[key];
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof raw.message === 'string') return raw.message;

  return `${label} is invalid.`;
}
