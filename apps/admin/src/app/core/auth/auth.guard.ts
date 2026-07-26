/**
 * Auth Guards — route protection.
 *
 *   authGuard             — must be authenticated
 *   guestGuard            — must NOT be authenticated (e.g. /auth/login)
 *   roleGuard(...)        — must hold one of the given roles
 *   permissionGuard(...)  — must have ALL of the given permission codes
 *   tenantResolvedGuard   — must have an active tenant (in case of edge cases)
 *   mfaEnrolledGuard      — must have MFA enrolled (for high-risk screens)
 *
 * Each guard is a CanActivateFn (function) that uses `inject()` for DI. The
 * old class-based guard is kept for backward compatibility.
 */
import { inject } from '@angular/core';
import { CanActivateFn, CanActivateChildFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthStore } from './auth.store';
import { PermissionService } from './permission.service';
import { MfaService } from './mfa.service';
import { UserRole } from '@shared/models';

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

export const authChildGuard: CanActivateChildFn = (_route, state) => authGuard(_route, state);

/** Must NOT be authenticated. Used for the /auth/* routes. */
export const guestGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);
  if (!store.isAuthenticated()) return true;
  router.navigate(['/dashboard'], { replaceUrl: true });
  return false;
};

/** Must hold at least one of the listed roles. */
export const roleGuard =
  (...roles: UserRole[]): CanActivateFn =>
  () => {
    const perms = inject(PermissionService);
    const router = inject(Router);
    if (!inject(AuthStore).isAuthenticated()) {
      return redirectToLogin(router);
    }
    return perms.is(roles) ? true : (router.navigate(['/forbidden'], { replaceUrl: true }), false);
  };

/** Must have ALL of the listed permission codes (or a wildcard). */
export const permissionGuard =
  (...codes: string[]): CanActivateFn =>
  () => {
    const perms = inject(PermissionService);
    const router = inject(Router);
    if (!inject(AuthStore).isAuthenticated()) {
      return redirectToLogin(router);
    }
    return perms.hasAll(...codes)
      ? true
      : (router.navigate(['/forbidden'], { replaceUrl: true }), false);
  };

/** Must have at least ONE of the listed permission codes. */
export const anyPermissionGuard =
  (...codes: string[]): CanActivateFn =>
  () => {
    const perms = inject(PermissionService);
    const router = inject(Router);
    if (!inject(AuthStore).isAuthenticated()) {
      return redirectToLogin(router);
    }
    return perms.hasAny(...codes)
      ? true
      : (router.navigate(['/forbidden'], { replaceUrl: true }), false);
  };

/** Must have a tenant resolved (should always be true post-login). */
export const tenantResolvedGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);
  if (!store.tenantId()) return redirectToLogin(router);
  return true;
};

/** Must have MFA enrolled. Useful for screens that touch sensitive data. */
export const mfaEnrolledGuard: CanActivateFn = () => {
  const mfa = inject(MfaService);
  const router = inject(Router);
  return mfa.isEnabled() ? true : (router.navigate(['/auth/mfa-enroll']), false);
};

