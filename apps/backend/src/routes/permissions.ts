import { Router, Request, Response, NextFunction } from 'express';
import { PermissionService } from '../services/permission.service';
import { authenticateToken, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    organizationId: string;
    role?: string;
  };
}

// Validation schemas
const checkPermissionSchema = z.object({
  permissions: z.union([z.string(), z.array(z.string())]),
  mode: z.enum(['any', 'all']).optional().default('any'),
});

const grantPermissionSchema = z.object({
  userId: z.string().uuid(),
  permissionId: z.string().uuid(),
  reason: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

const denyPermissionSchema = z.object({
  userId: z.string().uuid(),
  permissionId: z.string().uuid(),
  reason: z.string().optional(),
});

const auditLogQuerySchema = z.object({
  userId: z.string().optional(),
  limit: z.string().transform(Number).optional().default('100'),
  offset: z.string().transform(Number).optional().default('0'),
  action: z.string().optional(),
  status: z.enum(['allowed', 'denied', 'pending_approval']).optional(),
});

export function createPermissionRoutes(permissionService: PermissionService): Router {
  const router = Router();

  /**
   * POST /api/v1/permissions/check
   * Check if user has permission(s)
   */
  /**
   * @swagger
   * /api/v1/permissions/check:
   *   post:
   *     summary: Check if the current user has one or more permissions
   *     tags: [Permissions]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [permissions]
   *             properties:
   *               permissions:
   *                 oneOf:
   *                   - type: string
   *                   - type: array
   *                     items:
   *                       type: string
   *               mode:
   *                 type: string
   *                 enum: [any, all]
   *                 default: any
   *     responses:
   *       200:
   *         description: Permission check result
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 allowed:
   *                   type: boolean
   *                 permissions:
   *                   type: array
   *                   items:
   *                     type: string
   *       401:
   *         description: Unauthorized
   */
  router.post(
    '/check',
    authenticateToken,
    validateRequest(checkPermissionSchema),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId || !req.user?.id) {
          return res.status(403).json({ error: 'No organization context' });
        }

        const { permissions, mode } = req.body;
        const permissionKeys = Array.isArray(permissions) ? permissions : [permissions];

        let hasPermission: boolean;
        if (mode === 'all') {
          hasPermission = await permissionService.hasAllPermissions(
            req.user.id,
            req.user.organizationId,
            permissionKeys
          );
        } else {
          hasPermission = await permissionService.hasAnyPermission(
            req.user.id,
            req.user.organizationId,
            permissionKeys
          );
        }

        // Audit log
        await permissionService.auditLog(
          req.user.id,
          req.user.organizationId,
          'check_permission',
          null,
          null,
          hasPermission ? 'allowed' : 'denied',
          {
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            resourceType: 'permission',
            changeData: { permissions: permissionKeys },
          }
        );

        return res.json({ allowed: hasPermission, permissions: permissionKeys });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/permissions/user
   * Get current user's permissions
   */
  /**
   * @swagger
   * /api/v1/permissions/user:
   *   get:
   *     summary: Get current user's permissions and denied permissions
   *     tags: [Permissions]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: User permission context
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 userId:
   *                   type: string
   *                   format: uuid
   *                 role:
   *                   type: string
   *                 permissions:
   *                   type: array
   *                   items:
   *                     type: string
   *                 denied:
   *                   type: array
   *                   items:
   *                     type: string
   *       401:
   *         description: Unauthorized
   */
  router.get(
    '/user',
    authenticateToken,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId || !req.user?.id) {
          return res.status(403).json({ error: 'No organization context' });
        }

        const context = await permissionService.getUserPermissionContext(
          req.user.id,
          req.user.organizationId
        );

        return res.json({
          userId: context.userId,
          role: context.userRole,
          permissions: Array.from(context.permissions),
          denied: Array.from(context.deniedPermissions),
          cacheExpiry: new Date(context.cacheExpiry),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/permissions/screens
   * Get accessible screens for user
   */
  router.get(
    '/screens',
    authenticateToken,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId || !req.user?.id) {
          return res.status(403).json({ error: 'No organization context' });
        }

        const screens = await permissionService.getUserScreens(
          req.user.id,
          req.user.organizationId
        );

        return res.json({ items: screens });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/permissions/list
   * Get all permissions in organization (admin)
   */
  router.get(
    '/list',
    authenticateToken,
    authorize('admin', 'owner'),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId) {
          return res.status(403).json({ error: 'No organization context' });
        }

        const resource = req.query.resource as string | undefined;
        let permissions;

        if (resource) {
          permissions = await permissionService.getPermissionsByResource(
            req.user.organizationId,
            resource
          );
        } else {
          permissions = await permissionService.getPermissions(req.user.organizationId);
        }

        return res.json({ items: permissions });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/permissions/screens/all
   * Get all screens (admin)
   */
  router.get(
    '/screens/all',
    authenticateToken,
    authorize('admin', 'owner'),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId) {
          return res.status(403).json({ error: 'No organization context' });
        }

        const screens = await permissionService.getScreens(req.user.organizationId);

        return res.json({ items: screens });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/permissions/grant
   * Grant permission to user (admin)
   */
  router.post(
    '/grant',
    authenticateToken,
    authorize('admin', 'owner'),
    validateRequest(grantPermissionSchema),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId || !req.user?.id) {
          return res.status(403).json({ error: 'No organization context' });
        }

        const { userId, permissionId, reason, expiresAt } = req.body;

        await permissionService.grantPermissionToUser(
          userId,
          req.user.organizationId,
          permissionId,
          req.user.id,
          reason,
          expiresAt ? new Date(expiresAt) : undefined
        );

        // Audit log
        await permissionService.auditLog(
          req.user.id,
          req.user.organizationId,
          'grant_permission',
          permissionId,
          null,
          'allowed',
          {
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            resourceType: 'user',
            resourceId: userId,
            changeData: { reason, expiresAt },
          }
        );

        return res.json({ success: true, message: 'Permission granted' });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/permissions/deny
   * Deny permission for user (admin)
   */
  router.post(
    '/deny',
    authenticateToken,
    authorize('admin', 'owner'),
    validateRequest(denyPermissionSchema),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId || !req.user?.id) {
          return res.status(403).json({ error: 'No organization context' });
        }

        const { userId, permissionId, reason } = req.body;

        await permissionService.denyPermissionForUser(
          userId,
          req.user.organizationId,
          permissionId,
          req.user.id,
          reason
        );

        // Audit log
        await permissionService.auditLog(
          req.user.id,
          req.user.organizationId,
          'deny_permission',
          permissionId,
          null,
          'denied',
          {
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            resourceType: 'user',
            resourceId: userId,
            denyReason: reason,
          }
        );

        return res.json({ success: true, message: 'Permission denied' });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/permissions/audit
   * Get audit logs
   */
  router.get(
    '/audit',
    authenticateToken,
    authorize('admin', 'owner'),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId) {
          return res.status(403).json({ error: 'No organization context' });
        }

        const { userId, limit, offset, action, status } = auditLogQuerySchema.parse(req.query);

        const logs = await permissionService.getAuditLogs(
          req.user.organizationId,
          userId,
          limit,
          offset
        );

        // Filter by action and status if provided
        let filtered = logs;
        if (action) {
          filtered = filtered.filter(log => log.action === action);
        }
        if (status) {
          filtered = filtered.filter(log => log.status === status);
        }

        return res.json({
          items: filtered,
          total: filtered.length,
          limit,
          offset,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/permissions/audit/:userId
   * Get audit logs for specific user
   */
  router.get(
    '/audit/:userId',
    authenticateToken,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.organizationId) {
          return res.status(403).json({ error: 'No organization context' });
        }

        // Users can only view their own audit logs
        // unless they're admin
        const isAdmin = req.user.role === 'admin' || req.user.role === 'owner';
        if (!isAdmin && req.user.id !== req.params.userId) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const offset = parseInt(req.query.offset as string) || 0;

        const logs = await permissionService.getAuditLogs(
          req.user.organizationId,
          req.params.userId,
          limit,
          offset
        );

        return res.json({
          items: logs,
          limit,
          offset,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
