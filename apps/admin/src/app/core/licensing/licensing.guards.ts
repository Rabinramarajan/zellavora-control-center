import { Injectable, inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { LicensingService } from './licensing.service';

/**
 * Guard to protect routes/features based on license plan tier
 */
export function licenseTierGuard(requiredTier: number): CanActivateFn {
  return async (route, state) => {
    const licensingService = inject(LicensingService);
    const router = inject(Router);

    const license = licensingService.currentLicense();
    if (!license) return router.createUrlTree(['/login']);

    const plan = licensingService.currentPlan();
    if (!plan || plan.tier < requiredTier) {
      console.warn(`Access denied: Required tier ${requiredTier}, current tier ${plan?.tier || 0}`);
      return router.createUrlTree(['/upgrade']);
    }

    return true;
  };
}

/**
 * Guard to protect routes/features based on feature entitlement
 */
export function featureGuard(featureKey: string): CanActivateFn {
  return async (route, state) => {
    const licensingService = inject(LicensingService);
    const router = inject(Router);

    const orgId = route.params['orgId'] || route.parent?.params['orgId'];
    if (!orgId) return router.createUrlTree(['/login']);

    try {
      const hasFeature = await licensingService.checkFeature(orgId, featureKey);
      if (!hasFeature) {
        console.warn(`Feature not available: ${featureKey}`);
        return router.createUrlTree(['/upgrade']);
      }
      return true;
    } catch (err) {
      console.error('Failed to check feature access', err);
      return router.createUrlTree(['/upgrade']);
    }
  };
}

/**
 * Guard to protect routes/features based on module access
 */
export function moduleGuard(moduleKey: string): CanActivateFn {
  return async (route, state) => {
    const licensingService = inject(LicensingService);
    const router = inject(Router);

    const orgId = route.params['orgId'] || route.parent?.params['orgId'];
    if (!orgId) return router.createUrlTree(['/login']);

    try {
      const hasAccess = await licensingService.checkModule(orgId, moduleKey);
      if (!hasAccess) {
        console.warn(`Module not accessible: ${moduleKey}`);
        return router.createUrlTree(['/upgrade']);
      }
      return true;
    } catch (err) {
      console.error('Failed to check module access', err);
      return router.createUrlTree(['/upgrade']);
    }
  };
}

/**
 * Guard to check if organization is within usage limits
 */
export function usageLimitGuard(limitType: 'storage' | 'users' | 'projects' | 'api'): CanActivateFn {
  return async (route, state) => {
    const licensingService = inject(LicensingService);
    const router = inject(Router);

    const orgId = route.params['orgId'] || route.parent?.params['orgId'];
    if (!orgId) return router.createUrlTree(['/login']);

    try {
      await licensingService.loadUsage(orgId);
      const limits = licensingService.usageLimits();

      if (!limits?.withinLimits) {
        const hasLimitError = limits?.errors?.some(e => e.includes(limitType));
        if (hasLimitError) {
          console.warn(`Usage limit exceeded for: ${limitType}`);
          return router.createUrlTree(['/upgrade']);
        }
      }

      return true;
    } catch (err) {
      console.error('Failed to check usage limits', err);
      return true; // Fail open if check fails
    }
  };
}

/**
 * Guard to prevent deactivation if trial is about to expire
 */
export function trialWarningGuard(): CanDeactivateFn<any> {
  return (component, currentRoute, currentState, nextState) => {
    const licensingService = inject(LicensingService);
    const status = licensingService.licenseStatus();

    if (status?.isTrialEnding && status.daysRemaining && status.daysRemaining <= 3) {
      const confirm = window.confirm(
        `Your trial expires in ${status.daysRemaining} days. Are you sure you want to leave?`
      );
      return confirm;
    }

    return true;
  };
}

/**
 * Guard to ensure active subscription
 */
export function activeSubscriptionGuard(): CanActivateFn {
  return (route, state) => {
    const licensingService = inject(LicensingService);
    const router = inject(Router);

    const license = licensingService.currentLicense();
    if (!license) return router.createUrlTree(['/login']);

    if (license.status !== 'active' && license.status !== 'trial') {
      console.warn(`Access denied: License status is ${license.status}`);
      return router.createUrlTree(['/subscription']);
    }

    return true;
  };
}

/**
 * Guard to check if upgrade is needed
 */
export function upgradeGuard(
  requiredTier?: number,
  requiredFeature?: string,
  requiredModule?: string
): CanActivateFn {
  return async (route, state) => {
    const licensingService = inject(LicensingService);
    const router = inject(Router);

    const license = licensingService.currentLicense();
    const plan = licensingService.currentPlan();

    if (!license || !plan) return router.createUrlTree(['/login']);

    // Check tier
    if (requiredTier !== undefined && plan.tier < requiredTier) {
      return router.createUrlTree(['/upgrade']);
    }

    // Check feature
    if (requiredFeature) {
      const hasFeature = await licensingService.checkFeature(
        license.organizationId,
        requiredFeature
      );
      if (!hasFeature) {
        return router.createUrlTree(['/upgrade']);
      }
    }

    // Check module
    if (requiredModule) {
      const hasModule = await licensingService.checkModule(
        license.organizationId,
        requiredModule
      );
      if (!hasModule) {
        return router.createUrlTree(['/upgrade']);
      }
    }

    return true;
  };
}

/**
 * Guard to track navigation for analytics
 */
@Injectable({ providedIn: 'root' })
export class LicensingAnalyticsGuard {
  licensingService = inject(LicensingService);

  canActivate: CanActivateFn = (route, state) => {
    const orgId = route.params['orgId'] || route.parent?.params['orgId'];
    if (orgId) {
      this.licensingService.trackUsage(
        orgId,
        'page_visit',
        1,
        'route',
        route.component?.name || state.url
      ).catch(err => console.error('Failed to track usage', err));
    }
    return true;
  };
}
