/**
 * Auth Guards — route protection.
 *
 *   authGuard             — must be authenticated
 *   guestGuard            — must NOT be authenticated (e.g. /auth/login)
 *
 * Each guard is a CanActivateFn (function) that uses `inject()` for DI.
 */
import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthStore } from './auth.store';

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

