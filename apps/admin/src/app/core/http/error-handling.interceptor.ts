import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorBus } from '@core/error/error-bus';

export const errorHandlingInterceptor: HttpInterceptorFn = (req, next) => {
  const errorBus = inject(ErrorBus);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Do not handle if request specifically wants to hide error notification
      if (req.headers.has('hideErrorMethod')) {
        return throwError(() => err);
      }

      let message = 'An unexpected error occurred.';
      if (err.error && typeof err.error === 'object' && err.error.error && err.error.error.message) {
        message = err.error.error.message;
      } else if (err.message) {
        message = err.message;
      }

      if (err.status === 400) {
        errorBus.push({ kind: 'warning', message: `Validation failed: ${message}` });
      } else if (err.status === 404) {
        errorBus.push({ kind: 'warning', message: `Resource not found: ${message}` });
      } else if (err.status === 409) {
        errorBus.push({ kind: 'warning', message: `Conflict error: ${message}` });
      } else if (err.status >= 500) {
        errorBus.push({ kind: 'error', message: `Server error: ${message}` });
      }

      return throwError(() => err);
    })
  );
};
