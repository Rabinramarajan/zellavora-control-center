/**
 * Client-side validation for auth forms — a UX aid only; the API re-validates
 * everything. Mirrors apps/backend/src/modules/auth/auth.dto.ts.
 */
import {
  email,
  maxLength,
  minLength,
  required,
  validate,
  type SchemaPath,
  type SchemaPathRules,
} from '@angular/forms/signals';
import type { PasswordPolicy } from '../../../shared/models';

type StringPath = SchemaPath<string, SchemaPathRules.Supported>;

// Control characters (C0 + DEL + C1) are never valid in a person's name.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSymbol: true,
};

export interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

export function passwordRequirements(value: string, policy: PasswordPolicy): PasswordRequirement[] {
  const list: PasswordRequirement[] = [
    {
      id: 'length',
      label: `${policy.minLength}–${policy.maxLength} characters`,
      met: value.length >= policy.minLength && value.length <= policy.maxLength,
    },
  ];
  if (policy.requireUppercase) list.push({ id: 'upper', label: 'An uppercase letter', met: /[A-Z]/.test(value) });
  if (policy.requireLowercase) list.push({ id: 'lower', label: 'A lowercase letter', met: /[a-z]/.test(value) });
  if (policy.requireDigit) list.push({ id: 'digit', label: 'A number', met: /[0-9]/.test(value) });
  if (policy.requireSymbol) list.push({ id: 'symbol', label: 'A symbol', met: /[^A-Za-z0-9]/.test(value) });
  return list;
}

export function emailRules(path: StringPath): void {
  required(path, { message: 'Enter your email address.' });
  email(path, { message: 'Enter a valid email address, like name@company.com.' });
  maxLength(path, 254, { message: 'Email must be 254 characters or fewer.' });
}

export function nameRules(path: StringPath, label: string): void {
  required(path, { message: `Enter your ${label.toLowerCase()}.` });
  maxLength(path, 100, { message: `${label} must be 100 characters or fewer.` });
  validate(path, ({ value }) => {
    const trimmed = value().trim();
    if (trimmed && trimmed.length < 2) return { kind: 'minLength', message: `${label} must be at least 2 characters.` };
    if (CONTROL_CHARS.test(value())) return { kind: 'pattern', message: `${label} contains characters that aren't allowed.` };
    return null;
  });
}

/** A password being set: must satisfy the configured policy. Never truncated. */
export function newPasswordRules(path: StringPath, policy: () => PasswordPolicy): void {
  required(path, { message: 'Enter a new password.' });
  maxLength(path, 128, { message: 'Password must be 128 characters or fewer.' });
  validate(path, ({ value }) => {
    const unmet = passwordRequirements(value(), policy()).find((r) => !r.met);
    return value() && unmet
      ? { kind: 'passwordPolicy', message: `Password needs: ${unmet.label.toLowerCase()}.` }
      : null;
  });
}

/** A password being presented (sign-in, re-authentication): presence and length only. */
export function currentPasswordRules(path: StringPath, message = 'Enter your password.'): void {
  required(path, { message });
  maxLength(path, 128, { message: 'Password must be 128 characters or fewer.' });
}

export function confirmPasswordRules(path: StringPath, password: () => string): void {
  required(path, { message: 'Confirm your password.' });
  maxLength(path, 128, { message: 'Password must be 128 characters or fewer.' });
  validate(path, ({ value }) =>
    value() && value() !== password() ? { kind: 'mismatch', message: "Passwords don't match." } : null
  );
}

export function otpRules(path: StringPath): void {
  required(path, { message: 'Enter the 6-digit code.' });
  maxLength(path, 7, { message: 'The code is 6 digits.' });
  validate(path, ({ value }) =>
    value() && !/^\d{6}$/.test(value().replace(/\s/g, ''))
      ? { kind: 'pattern', message: 'The code is 6 digits.' }
      : null
  );
}

export function recoveryCodeRules(path: StringPath): void {
  required(path, { message: 'Enter a recovery code.' });
  maxLength(path, 16, { message: 'Recovery codes are 10 characters, like ABCDE-FGHJK.' });
  minLength(path, 10, { message: 'Recovery codes are 10 characters, like ABCDE-FGHJK.' });
  validate(path, ({ value }) =>
    value() && !/^[A-Za-z0-9]{10}$/.test(value().replace(/[-\s]/g, ''))
      ? { kind: 'pattern', message: 'Recovery codes are 10 characters, like ABCDE-FGHJK.' }
      : null
  );
}

export const normalizeOtp = (value: string): string => value.replace(/\s/g, '');
