/**
 * Auth HTTP Interceptor.
 *
 * Adds:
 *   - Authorization: Bearer <accessToken>   on every non-auth request
 *   - X-Tenant-ID: <tenantId>               on every request to /api/*
 *   - X-Request-ID: <uuid>                  for log correlation
 *
 * Handles:
 *   - 401 → try a single refresh → retry the original request
 *   - 401 again → log out (refresh token invalid / revoked / reused)
 *   - 423 ACCOUNT_LOCKED → push a global toast
 *   - 429 RATE_LIMITED → back off
 *
 * Concurrency: only one refresh in flight at a time. All other 401s wait on
 * the same promise via a Subject.
 */
import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';

import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';
import { ErrorBus } from '@core/error/error-bus';

const AUTH_FREE = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/auth/refresh', '/auth/validate-client', '/auth/login/mfa', '/auth/public-key'];

let inflightRefresh$: BehaviorSubject<string | null> | null = null;

const attachHeaders = (req: HttpRequest<unknown>, store: AuthStore): HttpRequest<unknown> => {
  const headers: Record<string, string> = {};
  const token = store.accessToken();
  const tenantId = store.tenantId();
  const requestId = crypto.randomUUID();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  headers['X-Request-ID'] = requestId;
  return req.clone({ setHeaders: headers });
};

const isAuthFree = (url: string): boolean => AUTH_FREE.some((p) => url.includes(p));

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AuthStore);
  const auth = inject(AuthService);
  const errors = inject(ErrorBus);

  const cloned = isAuthFree(req.url) ? req : attachHeaders(req, store);

  return next(cloned).pipe(
    catchError((err) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return handleNon401(err, errors);
      }

      // 401 on an auth-free URL → surface the error
      if (isAuthFree(req.url)) {
        const errResp = err as HttpErrorResponse;
        errors.push({ kind: 'auth', message: extractMessage(errResp) });
        return throwError(() => err);
      }

      // Coalesce concurrent 401s into a single refresh
      if (!inflightRefresh$) {
        inflightRefresh$ = new BehaviorSubject<string | null>(null);
        const rt = store.refreshToken();
        if (!rt) {
          inflightRefresh$ = null;
          return finalizeLogout(auth, errors);
        }
        auth.refresh({ refreshToken: rt }, { silent: true }).subscribe({
          next: (ok) => {
            inflightRefresh$!.next(ok ? store.accessToken() : null);
            inflightRefresh$!.complete();
            inflightRefresh$ = null;
            if (!ok) auth.logout(false).subscribe();
          },
          error: () => {
            inflightRefresh$!.next(null);
            inflightRefresh$!.complete();
            inflightRefresh$ = null;
          },
        });
      }

      return inflightRefresh$!.pipe(
        filter((t): t is string => !!t),
        take(1),
        switchMap((newToken) => {
          const retried = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
          return next(retried);
        }),
        catchError((e) => finalizeLogout(auth, errors, e))
      );
    })
  );
};

const handleNon401 = (err: unknown, errors: ErrorBus): Observable<never> => {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 423) errors.push({ kind: 'warning', message: 'Account locked. Try again later.' });
    if (err.status === 429) errors.push({ kind: 'warning', message: 'Too many requests. Slow down.' });
    if (err.status === 403) errors.push({ kind: 'warning', message: 'You do not have permission.' });
  }
  return throwError(() => err);
};

const finalizeLogout = (auth: AuthService, errors: ErrorBus, original?: unknown): Observable<never> => {
  errors.push({ kind: 'auth', message: 'Session expired. Please log in again.' });
  auth.logout(false).subscribe();
  return throwError(() => original ?? new Error('logged out'));
};

const extractMessage = (err: HttpErrorResponse): string => {
  const api = err.error as { error?: { message?: string } } | null;
  return api?.error?.message ?? 'Authentication failed.';
};
