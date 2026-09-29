/**
 * requirePermission middleware.
 *
 * Usage:
 *   router.post('/users', requirePermission('users:user:create'), handler);
 *
 * Behavior:
 *   - Reads userId, tenantId from req.auth (set by JWT middleware upstream)
 *   - Asks Permission Engine for the check
 *   - On deny: 403 + audit log entry
 *   - On allow: next()
 */
import { Request, Response, NextFunction } from 'express';
import type { PermissionEngine } from '../engine/permission-engine';
import type { AuditService } from '../services/audit.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; tenantId: string; role: string; sessionId: string };
    }
  }
}

export const requirePermission =
  (key: string) => async (req: Request, res: Response, next: NextFunction) => {
    const auth = req.auth;
    if (!auth) {
      return res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Missing auth context' },
      });
    }

    const engine: PermissionEngine | undefined = req.app.locals.engine;
    const audit: AuditService | undefined = req.app.locals.audit;
    if (!engine) {
      return res.status(500).json({
        error: { code: 'ENGINE_NOT_READY', message: 'Permission engine not initialized' },
      });
    }

    try {
      const { allowed, source } = await engine.check(auth.userId, auth.tenantId, key);

      if (!allowed) {
        if (audit) {
          // Fire-and-forget; failures don't block the response
          audit
            .log({
              organizationId: auth.tenantId,
              actorId: auth.userId,
              action: 'permission.deny',
              decision: 'deny',
              permissionKey: key,
              description: `Access denied to ${req.method} ${req.path}`,
              context: {
                method: req.method,
                path: req.path,
                ip: req.ip,
                ua: req.get('user-agent'),
              },
            })
            .catch(() => undefined);
        }
        return res.status(403).json({
          error: {
            code: 'PERMISSION_DENIED',
            message: `Missing permission: ${key}`,
            details: { required: key, source },
          },
        });
      }

      // Surface source for downstream observability
      res.setHeader('X-Permission-Source', source ?? 'role');
      next();
    } catch (err) {
      next(err);
    }
  };
