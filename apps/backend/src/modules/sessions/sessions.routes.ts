import { Router, type Response } from 'express';
import { authenticate, requirePermission, type AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';
import { orgContextOf } from '../../middleware/org-context';
import { SessionsService } from './sessions.service';
import { SessionIdParamSchema, SessionListQuerySchema, UserIdParamSchema } from './sessions.dto';

const router = Router();
const service = new SessionsService();

/**
 * @swagger
 * tags:
 *   name: iamSessions
 *   description: Live sign-in sessions across the organization.
 */

/**
 * @swagger
 * /api/v1/iam/sessions:
 *   get:
 *     summary: listSessions
 *     operationId: getIamSessions
 *     tags: [iamSessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         description: Filter by user name or email
 *         schema: { type: string }
 *       - in: query
 *         name: userId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated live sessions
 */
router.get(
  '/',
  authenticate,
  requirePermission('users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = orgContextOf(req);
    const query = SessionListQuerySchema.parse(req.query);
    res.json({ success: true, data: await service.list(organizationId, query, req.sessionId) });
  })
);

/**
 * @swagger
 * /api/v1/iam/sessions/stats:
 *   get:
 *     summary: getSessionStats
 *     operationId: getIamSessionsStats
 *     tags: [iamSessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active session and user counts
 */
router.get(
  '/stats',
  authenticate,
  requirePermission('users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = orgContextOf(req);
    res.json({ success: true, data: await service.stats(organizationId) });
  })
);

/**
 * @swagger
 * /api/v1/iam/sessions/users/{userId}:
 *   delete:
 *     summary: revokeUserSessions
 *     operationId: deleteIamSessionsUser
 *     description: Sign a user out everywhere (keeps the caller's own current session).
 *     tags: [iamSessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Number of sessions revoked
 */
router.delete(
  '/users/:userId',
  authenticate,
  requirePermission('users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const { userId } = UserIdParamSchema.parse(req.params);
    res.json({
      success: true,
      data: await service.revokeAllForUser(organizationId, userId, actorId, req.sessionId),
    });
  })
);

/**
 * @swagger
 * /api/v1/iam/sessions/{id}:
 *   delete:
 *     summary: revokeSession
 *     operationId: deleteIamSession
 *     tags: [iamSessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Session revoked
 */
router.delete(
  '/:id',
  authenticate,
  requirePermission('users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const { id } = SessionIdParamSchema.parse(req.params);
    res.json({
      success: true,
      data: await service.revoke(organizationId, id, actorId, req.sessionId),
    });
  })
);

export default router;
