/**
 * Error Interceptor — last line of defense.
 *
 * Responsibilities:
 *   - Normalize unknown errors into a consistent shape
 *   - Push non-fatal errors to the ErrorBus (toast)
 *   - Tag errors with the request-id for log correlation
 *   - Re-throw so callers can still handle them locally
 *
 * Order in app.config: this interceptor comes AFTER authInterceptor so that
 * 401s have already been handled (refresh or logout) by the time we get here.
 */
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorBus } from './error-bus';

export interface NormalizedError {
  status: number;
  code: string;
  message: string;
  requestId?: string;
  original?: unknown;
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const bus = inject(ErrorBus);

  return next(req).pipe(
    catchError((err) => {
      const norm = normalize(err);

      // Don't toast on 401 — the auth interceptor already handled it.
      if (norm.status === 401) return throwError(() => norm);

      if (norm.status >= 500) {
        bus.push({ kind: 'error', message: 'Server error. The team has been notified.' });
      } else if (norm.status === 0) {
        bus.push({ kind: 'error', message: 'Network error. Check your connection.' });
      } else if (norm.status === 403) {
        // 403 on user-initiated actions should be toasted
        bus.push({ kind: 'warning', message: norm.message });
      } else if (norm.status >= 400) {
        // 4xx other than 401/403/423/429 — let the calling component decide
        // (these are usually form-validation issues, not global events)
      }

      // Always log to console in dev for easier debugging
      // eslint-disable-next-line no-console
      console.warn('[http]', norm);

      return throwError(() => norm);
    })
  );
};

export const normalize = (err: unknown): NormalizedError => {
  if (err instanceof HttpErrorResponse) {
    const api = err.error as { error?: { code?: string; message?: string } } | null;
    return {
      status: err.status,
      code: api?.error?.code ?? 'UNKNOWN',
      message: api?.error?.message ?? err.message ?? 'Request failed',
      requestId: err.headers?.get('X-Request-ID') ?? undefined,
      original: err,
    };
  }
  if (err instanceof Error) {
    return { status: 0, code: 'CLIENT_ERROR', message: err.message, original: err };
  }
  return { status: 0, code: 'UNKNOWN', message: 'Unknown error', original: err };
};
