/**
 * Route guards.
 *
 * Three flavors:
 *   - permissionGuard(key)      : most common; route only if user has key
 *   - roleGuard(minLevel)       : legacy; numeric level hierarchy
 *   - featureGuard(feature)     : feature toggle
 *   - anyPermissionGuard(keys)  : pass if any of the listed perms
 *   - allPermissionsGuard(keys) : pass only if all perms present
 *
 * All use CanMatchFn so they short-circuit even before lazy chunks load.
 */
import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { PermissionService } from '../services/permission.service';
import { PolicyStore } from '../store/policy.store';

export const permissionGuard = (key: string): CanMatchFn =>
  (): boolean | UrlTree => {
    const perms = inject(PermissionService);
    const store = inject(PolicyStore);
    const router = inject(Router);

    if (!store.hasPolicy()) {
      // No policy loaded yet — the AuthService should redirect to login
      return router.createUrlTree(['/auth/login']);
    }
    return perms.canSync(key) ? true : router.createUrlTree(['/403']);
  };

export const anyPermissionGuard = (keys: string[]): CanMatchFn =>
  (): boolean | UrlTree => {
    const perms = inject(PermissionService);
    const store = inject(PolicyStore);
    const router = inject(Router);

    if (!store.hasPolicy()) return router.createUrlTree(['/auth/login']);
    return perms.canAny(keys) ? true : router.createUrlTree(['/403']);
  };

export const allPermissionsGuard = (keys: string[]): CanMatchFn =>
  (): boolean | UrlTree => {
    const perms = inject(PermissionService);
    const store = inject(PolicyStore);
    const router = inject(Router);

    if (!store.hasPolicy()) return router.createUrlTree(['/auth/login']);
    return perms.canAll(keys) ? true : router.createUrlTree(['/403']);
  };

export const roleGuard = (minLevel: number): CanMatchFn =>
  (): boolean | UrlTree => {
    const perms = inject(PermissionService);
    const router = inject(Router);
    return perms.maxRoleLevel() >= minLevel ? true : router.createUrlTree(['/403']);
  };

export const featureGuard = (feature: string): CanMatchFn =>
  (): boolean | UrlTree => {
    const perms = inject(PermissionService);
    const router = inject(Router);
    return perms.hasFeature(feature) ? true : router.createUrlTree(['/403']);
  };

export const roleKeyGuard = (...keys: string[]): CanMatchFn =>
  (): boolean | UrlTree => {
    const perms = inject(PermissionService);
    const router = inject(Router);
    return perms.hasAnyRole(keys) ? true : router.createUrlTree(['/403']);
  };
