import type { Response, NextFunction } from 'express';
import {
  authenticate as baseAuthenticate,
  requirePermission as baseRequirePermission,
  markGuard,
  resolvePlatformAdmin,
  type AuthRequest,
} from '../../../middleware/auth';
import { AppError } from '../../../middleware/error';

export type { AuthRequest };

/**
 * Admin Authentication Guard for the `/api/admin` tree.
 *
 * 1. Verifies the JWT and the active session.
 * 2. Requires real access: platform-operator status, or at least one effective permission from an
 *    ACTIVE role (direct or through a group). A bare role label on the token is not enough, so a
 *    user whose roles are all disabled, or who was never assigned one, is turned away here.
 *
 * Members legitimately use this tree (the Nexus app sends every call through it), so the guard
 * cannot demand an admin-only permission. Each mounted router still enforces its own permission.
 */
export const adminAuthGuard = markGuard(
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    await baseAuthenticate(req, res, async (err?: unknown) => {
      if (err) return next(err);
      try {
        if (await resolvePlatformAdmin(req)) return next();
        const { PermissionService } = await import('../../../services/auth');
        req.permissions ??= await PermissionService.loadForUser(
          req.userId as string,
          req.tenantId as string
        );
        if (req.permissions.size === 0) {
          throw new AppError('No access is granted to this account', 403, 'FORBIDDEN_NO_ACCESS');
        }
        return next();
      } catch (e) {
        return next(e);
      }
    });
  }
);

/**
 * Granular Admin permission check.
 */
export const requireAdminPermission = (...codes: string[]) => {
  return baseRequirePermission(...codes);
};
