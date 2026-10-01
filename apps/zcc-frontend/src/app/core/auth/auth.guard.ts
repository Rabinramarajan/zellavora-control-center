/**
 * Route guards — UX only. The API independently authorizes every request.
 *
 *   authGuard           — must be signed in (ZCC app and /account/*)
 *   guestGuard          — must NOT be signed in (sign-in, registration, recovery pages)
 *   mfaChallengeGuard   — requires a live, server-issued 2FA challenge
 *   registrationGuard   — /auth/register only when self-registration is enabled
 *   permissionGuard     — signed in AND holds a permission (CanActivate)
 *   canMatchPermission  — signed in AND holds a permission (CanMatch)
 */
import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';
import { PermissionService } from '../rbac/services/permission.service';

const REDIRECT_KEY = 'zcc.redirect';

const rememberRedirect = (state: RouterStateSnapshot): void => {
  if (state.url && !state.url.startsWith('/auth/')) sessionStorage.setItem(REDIRECT_KEY, state.url);
};

const loginTree = (): UrlTree => inject(Router).createUrlTree(['/auth/login']);

export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthStore).isAuthenticated()) return true;
  rememberRedirect(state);
  return loginTree();
};

export const guestGuard: CanActivateFn = () =>
  inject(AuthStore).isAuthenticated() ? inject(Router).createUrlTree(['/dashboard']) : true;

export const mfaChallengeGuard: CanActivateFn = () =>
  inject(AuthService).pendingMfaChallenge() ? true : loginTree();

export const registrationGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .config()
    .pipe(
      map((config) =>
        config.selfRegistrationEnabled ? true : router.createUrlTree(['/auth/login'])
      ),
      catchError(() => of(router.createUrlTree(['/auth/login'])))
    );
};

const authenticatedAndAllowed = (
  permission: string
): boolean | UrlTree | Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const permissions = inject(PermissionService);
  if (!inject(AuthStore).isAuthenticated()) return router.createUrlTree(['/auth/login']);

  const decide = (): boolean | UrlTree =>
    permissions.canSync(permission) ? true : router.createUrlTree(['/dashboard']);

  // The policy may not be materialized yet (cold start). Refresh once so the
  // guard reflects server truth before deciding.
  if (!permissions.canSync(permission) && permissions.maxRoleLevel() === 0) {
    return permissions.refreshPolicy().then(decide, () => router.createUrlTree(['/dashboard']));
  }
  return decide();
};

/** Usage: `canActivate: [permissionGuard('resources:read')]` */
export const permissionGuard =
  (permission: string): CanActivateFn =>
  (_route, state) => {
    rememberRedirect(state);
    return authenticatedAndAllowed(permission);
  };

/** Usage: `canMatch: [canMatchPermission('users:read')]` — skips loading the chunk when denied. */
export const canMatchPermission =
  (permission: string): CanMatchFn =>
  () =>
    authenticatedAndAllowed(permission);
