import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { timer, throwError } from 'rxjs';
import { retry } from 'rxjs/operators';

export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  const retryCount = 2;
  const retryDelay = 1000;

  return next(req).pipe(
    retry({
      count: retryCount,
      delay: (error: HttpErrorResponse, count: number) => {
        // Only retry on network errors or 503 Service Unavailable
        if (error.status === 0 || error.status === 503) {
          console.warn(`[HTTP Retry] Attempt ${count} for ${req.method} "${req.url}" failed. Retrying in ${retryDelay}ms...`);
          return timer(retryDelay);
        }
        return throwError(() => error);
      },
    })
  );
};
