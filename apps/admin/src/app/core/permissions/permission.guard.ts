import {
  CanActivateFn,
  CanDeactivateFn,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { inject } from '@angular/core';
import { PermissionService } from './permission.service';
import { AuthStore } from '../auth/auth.store';

/**
 * Guard: Requires user to have specific permission
 *
 * Usage in route config:
 *   {
 *     path: 'projects',
 *     component: ProjectsComponent,
 *     canActivate: [permissionGuard()],
 *     data: { requiredPermission: 'projects:view' }
 *   }
 */
export const permissionGuard = (
  requiredPermission?: string | string[]
): CanActivateFn => {
  return async (
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean | UrlTree> => {
    const permissionService = inject(PermissionService);
    const router = inject(Router);
    const authStore = inject(AuthStore);

    // Check if user is authenticated
    if (!authStore.isAuthenticated()) {
      return router.parseUrl('/auth/login');
    }

    // Get required permission from parameter or route data
    const permission =
      requiredPermission || route.data['requiredPermission'];

    if (!permission) {
      // No permission required
      return true;
    }

    try {
      const permissions = Array.isArray(permission) ? permission : [permission];
      const mode = route.data['permissionMode'] || 'any';
      const hasPermission = await permissionService.hasPermission(permissions, mode);

      if (!hasPermission) {
        console.warn(`User lacks required permission: ${permissions.join(', ')}`);
        return router.parseUrl('/forbidden');
      }

      return true;
    } catch (error) {
      console.error('Permission check failed', error);
      return router.parseUrl('/error');
    }
  };
};

/**
 * Guard: Requires user to have ANY of the specified permissions
 *
 * Usage in route config:
 *   {
 *     path: 'admin',
 *     component: AdminComponent,
 *     canActivate: [hasAnyPermissionGuard(['admin:panel', 'admin:users'])]
 *   }
 */
export const hasAnyPermissionGuard = (
  permissions: string[]
): CanActivateFn => {
  return async (
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean | UrlTree> => {
    const permissionService = inject(PermissionService);
    const router = inject(Router);
    const authStore = inject(AuthStore);

    if (!authStore.isAuthenticated()) {
      return router.parseUrl('/auth/login');
    }

    try {
      const hasPermission = await permissionService.hasAnyPermission(permissions);

      if (!hasPermission) {
        return router.parseUrl('/forbidden');
      }

      return true;
    } catch (error) {
      console.error('Permission check failed', error);
      return router.parseUrl('/error');
    }
  };
};

/**
 * Guard: Requires user to have ALL specified permissions
 *
 * Usage in route config:
 *   {
 *     path: 'sensitive',
 *     component: SensitiveComponent,
 *     canActivate: [hasAllPermissionsGuard(['users:view', 'users:edit', 'users:delete'])]
 *   }
 */
export const hasAllPermissionsGuard = (
  permissions: string[]
): CanActivateFn => {
  return async (
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean | UrlTree> => {
    const permissionService = inject(PermissionService);
    const router = inject(Router);
    const authStore = inject(AuthStore);

    if (!authStore.isAuthenticated()) {
      return router.parseUrl('/auth/login');
    }

    try {
      const hasPermission = await permissionService.hasAllPermissions(permissions);

      if (!hasPermission) {
        return router.parseUrl('/forbidden');
      }

      return true;
    } catch (error) {
      console.error('Permission check failed', error);
      return router.parseUrl('/error');
    }
  };
};

/**
 * Guard: Confirms before leaving page if there are unsaved changes
 *
 * Usage in route config:
 *   {
 *     path: 'edit',
 *     component: EditComponent,
 *     canDeactivate: [unsavedChangesGuard]
 *   }
 */
export const unsavedChangesGuard: CanDeactivateFn<any> = (
  component: any,
  currentRoute: ActivatedRouteSnapshot,
  currentState: RouterStateSnapshot,
  nextState: RouterStateSnapshot
): boolean | UrlTree => {
  // Check if component has unsaved changes
  if (component && typeof component.hasUnsavedChanges === 'function') {
    if (component.hasUnsavedChanges()) {
      return window.confirm(
        'You have unsaved changes. Do you really want to leave?'
      );
    }
  }

  return true;
};

/**
 * Guard: Screen access guard
 * Checks if user can access a specific screen
 *
 * Usage in route config:
 *   {
 *     path: 'dashboard',
 *     component: DashboardComponent,
 *     canActivate: [screenAccessGuard('dashboard')]
 *   }
 */
export const screenAccessGuard = (screenKey: string): CanActivateFn => {
  return async (
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean | UrlTree> => {
    const permissionService = inject(PermissionService);
    const router = inject(Router);
    const authStore = inject(AuthStore);

    if (!authStore.isAuthenticated()) {
      return router.parseUrl('/auth/login');
    }

    try {
      const canAccess = permissionService.canAccessScreen(screenKey);

      if (!canAccess) {
        return router.parseUrl('/forbidden');
      }

      return true;
    } catch (error) {
      console.error('Screen access check failed', error);
      return router.parseUrl('/error');
    }
  };
};

/**
 * Guard: MFA requirement for sensitive operations
 *
 * Usage in route config:
 *   {
 *     path: 'sensitive',
 *     component: SensitiveComponent,
 *     canActivate: [mfaRequiredGuard]
 *   }
 */
export const mfaRequiredGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Promise<boolean | UrlTree> => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  const hasMfa = authStore.user()?.mfaEnabled ?? false;

  if (!hasMfa) {
    // Redirect to MFA setup
    return router.parseUrl('/auth/setup-mfa?returnUrl=' + state.url);
  }

  return true;
};
