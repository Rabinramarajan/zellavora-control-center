import { inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { FieldTree, ValidationError } from '@angular/forms/signals';
import { catchError, map, of } from 'rxjs';
import type { PasswordPolicy } from '@shared/models';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorMessage, apiFieldErrors } from '@core/auth/auth-errors';
import { DEFAULT_PASSWORD_POLICY } from './auth-validation';

export interface ServerErrorResult {
  /** Errors to return from a signal-form submission action, shown under their fields. */
  fieldErrors: ValidationError.WithFieldTree[];
  /** Form-level message when the error doesn't belong to a single field. */
  message: string | null;
}

/**
 * Splits an API failure into per-field errors (for fields the form owns) and a
 * form-level message. `aliases` maps API field names to form field names.
 */
export function mapServerErrors(
  err: unknown,
  fields: Record<string, FieldTree<unknown>>,
  fallback: string,
  aliases: Record<string, string> = {}
): ServerErrorResult {
  const fieldErrors: ValidationError.WithFieldTree[] = [];
  for (const [apiField, message] of Object.entries(apiFieldErrors(err))) {
    const field = fields[aliases[apiField] ?? apiField];
    if (field) fieldErrors.push({ kind: 'server', message, fieldTree: field });
  }
  return { fieldErrors, message: fieldErrors.length ? null : apiErrorMessage(err, fallback) };
}

/** The server's password policy, falling back to the documented default until it loads. */
export function injectPasswordPolicy(): Signal<PasswordPolicy> {
  return toSignal(
    inject(AuthService)
      .config()
      .pipe(
        map((c) => c.passwordPolicy),
        catchError(() => of(DEFAULT_PASSWORD_POLICY))
      ),
    { initialValue: DEFAULT_PASSWORD_POLICY }
  );
}

/** Reads a query parameter once and removes it from the address bar and history entry. */
export function takeQueryToken(name = 'token'): string {
  const url = new URL(window.location.href);
  const token = url.searchParams.get(name) ?? '';
  if (token) {
    url.searchParams.delete(name);
    // Keeps single-use secrets out of the visible URL, history and Referer headers.
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }
  return token;
}
