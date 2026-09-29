/**
 * Auth HTTP Interceptor.
 *
 * Adds:
 *   - Authorization: Bearer <accessToken>   on authenticated requests
 *   - X-Tenant-ID / X-Request-ID            for tenant cross-check and log correlation
 *
 * Handles 401 on an authenticated request: one shared refresh, then a retry.
 * If the refresh fails the session is gone — local state is cleared and the
 * user lands on /auth/session-expired. The failed request is never replayed
 * after re-authentication.
 */
import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';
import { ErrorBus } from '@core/error/error-bus';

/** Public auth endpoints: never carry a bearer token and never trigger refresh. */
const PUBLIC_AUTH_PATHS = [
  '/api/v1/auth/config',
  '/api/v1/auth/clients',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/register',
  '/api/v1/auth/invitations/',
  '/api/v1/auth/verify-email',
  '/api/v1/auth/resend-verification',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
];

const isPublicAuth = (url: string): boolean => PUBLIC_AUTH_PATHS.some((p) => url.includes(p));

const withAuthHeaders = (req: HttpRequest<unknown>, store: AuthStore): HttpRequest<unknown> => {
  const headers: Record<string, string> = { 'X-Request-ID': crypto.randomUUID() };
  const token = store.accessToken();
  const tenantId = store.tenantId();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  return req.clone({ setHeaders: headers });
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AuthStore);
  const auth = inject(AuthService);
  const errors = inject(ErrorBus);

  if (isPublicAuth(req.url)) return next(req);

  const sent = withAuthHeaders(req, store);
  return next(sent).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || !store.accessToken()) {
        return surface(err, errors);
      }
      const refreshToken = store.refreshToken();
      if (!refreshToken) return expire(auth, err);

      // A late 401 may belong to a token another request has already rotated.
      const renewed = sent.headers.get('Authorization') !== `Bearer ${store.accessToken()}`;
      return (renewed ? of(true) : auth.refresh(refreshToken)).pipe(
        switchMap((ok) => (ok ? next(withAuthHeaders(req, store)) : expire(auth, err))),
        catchError((retryErr: unknown) =>
          retryErr instanceof HttpErrorResponse && retryErr.status === 401
            ? expire(auth, retryErr)
            : surface(retryErr, errors)
        )
      );
    })
  );
};

const surface = (err: unknown, errors: ErrorBus): Observable<never> => {
  if (err instanceof HttpErrorResponse && err.status === 403) {
    errors.push({ kind: 'warning', message: 'You do not have permission to do that.' });
  }
  return throwError(() => err);
};

const expire = (auth: AuthService, err: unknown): Observable<never> => {
  auth.expireSession();
  return throwError(() => err);
};
