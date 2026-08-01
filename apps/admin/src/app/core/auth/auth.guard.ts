/**
 * Auth Guards — route protection.
 *
 *   authGuard             — must be authenticated
 *   guestGuard            — must NOT be authenticated (e.g. /auth/login)
 *   permissionGuard       — must be authenticated AND hold a permission (CanActivate)
 *   canMatchPermission    — must be authenticated AND hold a permission (CanMatch)
 *
 * Each guard is a CanActivateFn/CanMatchFn (function) that uses `inject()` for DI.
 */
import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthStore } from './auth.store';
import { PermissionService } from '../rbac/services/permission.service';

const rememberRedirect = (state: RouterStateSnapshot): void => {
  if (state.url && !state.url.startsWith('/auth/')) {
    sessionStorage.setItem('zcc.redirect', state.url);
  }
};

const redirectToLogin = (router: Router): false => {
  router.navigate(['/auth/login'], { replaceUrl: true });
  return false;
};

/** Must be authenticated. Stash the original URL so login can return there. */
export const authGuard: CanActivateFn = (_route, state) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  if (store.isAuthenticated()) return true;
  rememberRedirect(state);
  return redirectToLogin(router);
};

/** Must NOT be authenticated. Used for the /auth/* routes. */
export const guestGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);
  if (!store.isAuthenticated()) return true;
  router.navigate(['/dashboard'], { replaceUrl: true });
  return false;
};

const authenticatedAndAllowed = (
  permission: string,
  fallback: string
): boolean | Promise<boolean> => {
  const store = inject(AuthStore);
  const router = inject(Router);
  const permissions = inject(PermissionService);

  if (!store.isAuthenticated()) {
    router.navigate(['/auth/login'], { replaceUrl: true });
    return false;
  }

  // The policy may not be materialized yet (cold start). Refresh once so the
  // guard reflects server truth before deciding.
  if (!permissions.canSync(permission) && permissions.maxRoleLevel() === 0) {
    return permissions.refreshPolicy().then(
      () => {
        if (permissions.canSync(permission)) return true;
        router.navigate([fallback], { replaceUrl: true });
        return false;
      },
      () => {
        router.navigate([fallback], { replaceUrl: true });
        return false;
      }
    );
  }

  if (permissions.canSync(permission)) return true;
  router.navigate([fallback], { replaceUrl: true });
  return false;
};

/**
 * Must be authenticated AND hold the given permission (CanActivate).
 * Usage: `canActivate: [permissionGuard('resources:read')]`
 */
export const permissionGuard =
  (permission: string): CanActivateFn =>
  (_route, state) => {
    if (state.url && !state.url.startsWith('/auth/')) {
      sessionStorage.setItem('zcc.redirect', state.url);
    }
    return authenticatedAndAllowed(permission, '/dashboard');
  };

/**
 * Must be authenticated AND hold the given permission (CanMatch).
 * Use on lazy-loaded route groups to skip loading the chunk entirely when the
 * user lacks the permission.
 * Usage: `canMatch: [canMatchPermission('users:read')]`
 */
export const canMatchPermission =
  (permission: string): CanMatchFn =>
  () =>
    authenticatedAndAllowed(permission, '/dashboard');

