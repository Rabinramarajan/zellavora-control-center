import type { Response, NextFunction } from 'express';
import {
  authenticate as baseAuthenticate,
  markGuard,
  requirePermission as baseRequirePermission,
  resolvePlatformAdmin,
  type AuthRequest,
} from '../../../middleware/auth';

export type { AuthRequest };

/** Permission that opens the admin console API; every mounted router still checks its own. */
export const ADMIN_ACCESS_PERMISSION = 'admin:access';

/**
 * Admin Authentication Guard.
 * 1. Verifies the JWT and active session.
 * 2. Requires the named `admin:access` permission (or platform-operator status), so holding
 *    some role is not enough to reach the admin tree.
 */
export const adminAuthGuard = markGuard(
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    await baseAuthenticate(req, res, async (err?: unknown) => {
      if (err) return next(err);
      try {
        if (await resolvePlatformAdmin(req)) return next();
      } catch (e) {
        return next(e);
      }
      return baseRequirePermission(ADMIN_ACCESS_PERMISSION)(req, res, next);
    });
  }
);

/**
 * Granular Admin permission check.
 */
export const requireAdminPermission = (...codes: string[]) => {
  return baseRequirePermission(...codes);
};
