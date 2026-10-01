import { HttpErrorResponse } from '@angular/common/http';
import type { ApiError } from '../../shared/models';

export type ApiErrorBody = ApiError['error'];

/** The API error envelope, or null for network / non-API failures. */
export function apiError(err: unknown): ApiErrorBody | null {
  if (!(err instanceof HttpErrorResponse)) return null;
  const body = (err.error as ApiError | null)?.error;
  return body && typeof body.code === 'string' ? body : null;
}

export function apiErrorCode(err: unknown): string | null {
  return apiError(err)?.code ?? null;
}

/** A user-facing message that never exposes transport or security internals. */
export function apiErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Cannot reach the server. Check your connection and try again.';
    if (err.status === 429) return 'Too many attempts. Please try again later.';
    const body = apiError(err);
    if (body?.message && err.status < 500) return body.message;
    if (err.status >= 500)
      return 'The service is temporarily unavailable. Please try again shortly.';
  }
  return fallback;
}

/** Field-level messages from a VALIDATION_ERROR (or a single-field error) response. */
export function apiFieldErrors(err: unknown): Record<string, string> {
  const body = apiError(err);
  if (!body) return {};
  if (body.fields) return body.fields;
  if (body.field) return { [body.field]: body.message };
  return {};
}
