/**
 * Policy-Version Interceptor
 *
 * Every server response may carry an `X-Policy-Version` header. If the
 * value is greater than the client's cached version, we silently refresh
 * the policy in the background. This makes the UI reactive to permission
 * changes without requiring the user to reload.
 */
import { Injectable, inject } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { PolicyStore } from '../store/policy.store';
import { PermissionService } from '../services/permission.service';

@Injectable()
export class PolicyVersionInterceptor implements HttpInterceptor {
  private store = inject(PolicyStore);
  private perms = inject(PermissionService);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          const serverHeader = event.headers.get('X-Policy-Version');
          if (!serverHeader) return;

          const serverVersion = Number(serverHeader);
          if (Number.isNaN(serverVersion)) return;

          const localVersion = this.store.version();
          if (serverVersion > localVersion) {
            // Fire-and-forget; failure doesn't break the response
            this.perms.refreshPolicy().catch(() => undefined);
          }
        }
      })
    );
  }
}
