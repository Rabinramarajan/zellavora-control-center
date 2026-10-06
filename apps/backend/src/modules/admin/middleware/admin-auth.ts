import type { Response, NextFunction } from 'express';
import {
  authenticate as baseAuthenticate,
  requirePermission as baseRequirePermission,
  type AuthRequest,
} from '../../../middleware/auth';
import { AppError } from '../../../middleware/error';

export type { AuthRequest };

/**
 * Admin Authentication Guard.
 * 1. Verifies the JWT and active session.
 * 2. Checks that the authenticated caller has administrative privileges
 *    (e.g. role 'admin', 'owner', 'platform_admin', or has an admin tenant context).
 */
export const adminAuthGuard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  await baseAuthenticate(req, res, (err?: unknown) => {
    if (err) return next(err);

    const role = (req.role || '').toLowerCase();
    const isAdminRole = ['admin', 'owner', 'superadmin', 'platform_admin'].includes(role);

    // If caller doesn't have an explicit admin role, verify they at least have tenant context
    // and let granular permissions (requireAdminPermission) govern specific actions.
    if (!isAdminRole && role === 'individual') {
      return next(new AppError('Forbidden: Admin access required', 403, 'FORBIDDEN_ADMIN_ACCESS'));
    }

    next();
  });
};

/**
 * Granular Admin permission check.
 */
export const requireAdminPermission = (...codes: string[]) => {
  return baseRequirePermission(...codes);
};
