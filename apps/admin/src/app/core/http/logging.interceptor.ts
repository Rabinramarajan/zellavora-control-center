import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { tap } from 'rxjs/operators';

export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    tap({
      next: (event) => {
        // HTTP response handling
        if (!(event instanceof HttpResponse)) {
          return;
        }
      },
    })
  );
};
