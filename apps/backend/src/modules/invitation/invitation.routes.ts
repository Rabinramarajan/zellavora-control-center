import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission, type AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { asyncHandler } from '../../middleware/async-handler';
import { InvitationService, type InviteActor, type InviteInput } from './invitation.service';

const router = Router();
const service = new InvitationService();

const personName = z.string().trim().min(2).max(100).optional().nullable();
const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  firstName: personName,
  lastName: personName,
});
const IdSchema = z.object({ invitationId: z.string().uuid() });
const ListSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const actorOf = (req: AuthRequest): InviteActor => {
  if (!req.userId || !req.tenantId) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  return {
    userId: req.userId,
    organizationId: req.tenantId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
};

/**
 * @swagger
 * /api/v1/invitations:
 *   get:
 *     summary: listInvitations
 *     operationId: getInvitations
 *     description: Paginated invitations with per-status counts. `expired` = pending past expiry.
 *     tags: [invitations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, accepted, revoked, expired] }
 *     responses:
 *       200:
 *         description: Invitations
 */
router.get(
  '/',
  authenticate,
  requirePermission('users:read', 'users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = actorOf(req);
    const query = ListSchema.parse(req.query) as Parameters<InvitationService['list']>[1];
    res.json({ success: true, data: await service.list(organizationId, query) });
  })
);

/**
 * @swagger
 * /api/v1/invitations:
 *   post:
 *     summary: inviteUser
 *     operationId: postInvitations
 *     tags: [invitations]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *     responses:
 *       201:
 *         description: Invitation sent
 *       409:
 *         description: Email already belongs to an active account
 */
router.post(
  '/',
  authenticate,
  requirePermission('users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // tsconfig is non-strict, so zod widens required keys to optional; the schema enforces them.
    const dto = InviteSchema.parse(req.body) as InviteInput;
    res.status(201).json(await service.invite(dto, actorOf(req)));
  })
);

/**
 * @swagger
 * /api/v1/invitations/{invitationId}/resend:
 *   post:
 *     summary: resendInvitation
 *     operationId: postInvitationsByInvitationIdResend
 *     description: Issues a fresh link; the previous link stops working.
 *     tags: [invitations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Invitation re-sent
 */
router.post(
  '/:invitationId/resend',
  authenticate,
  requirePermission('users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { invitationId } = IdSchema.parse(req.params);
    res.json(await service.resend(invitationId, actorOf(req)));
  })
);

/**
 * @swagger
 * /api/v1/invitations/{invitationId}/revoke:
 *   post:
 *     summary: revokeInvitation
 *     operationId: postInvitationsByInvitationIdRevoke
 *     tags: [invitations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Invitation revoked
 */
router.post(
  '/:invitationId/revoke',
  authenticate,
  requirePermission('users:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { invitationId } = IdSchema.parse(req.params);
    res.json(await service.revoke(invitationId, actorOf(req)));
  })
);

export default router;
