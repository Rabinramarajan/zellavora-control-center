import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { tap } from 'rxjs/operators';

export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const started = Date.now();
  console.log(`[HTTP Request] ${req.method} "${req.urlWithParams}" started.`);

  return next(req).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          const elapsed = Date.now() - started;
          console.log(`[HTTP Response] ${req.method} "${req.urlWithParams}" succeeded in ${elapsed}ms. Status: ${event.status}`);
        }
      },
      error: (error) => {
        const elapsed = Date.now() - started;
        console.error(`[HTTP Response] ${req.method} "${req.urlWithParams}" failed in ${elapsed}ms. Error:`, error);
      },
    })
  );
};
