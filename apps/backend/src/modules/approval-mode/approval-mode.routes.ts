import { Router } from 'express';
import { ApprovalMode } from '@prisma/client';
import { z } from 'zod';
import { authGuard, requirePermission } from '../../middleware/auth';
import { asyncRoute, requestContext } from '../daily-sheets/sheets.shared';
import { ApprovalModeService } from './approval-mode.service';

const ModeSchema = z.nativeEnum(ApprovalMode);
const SetOrganizationModeSchema = z.object({ mode: ModeSchema }).strict();
const SetMemberModeSchema = z.object({ mode: ModeSchema.nullable() }).strict();

const router = Router();

router.use(authGuard);

/**
 * @swagger
 * /api/v1/approval-mode:
 *   get:
 *     summary: getApprovalMode
 *     description: The caller's organization mode, personal override and the mode in effect for their sheets.
 *     operationId: getApprovalMode
 *     tags: [approvalMode]
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get(
  '/',
  asyncRoute(async (req, res) => {
    const { organizationId, userId } = requestContext(req);
    res.json({ success: true, data: await ApprovalModeService.view(userId, organizationId) });
  })
);

/**
 * @swagger
 * /api/v1/approval-mode:
 *   put:
 *     summary: setOrganizationApprovalMode
 *     description: Switching to NONE is refused with APPROVAL_QUEUE_NOT_EMPTY while affected sheets await review.
 *     operationId: putApprovalMode
 *     tags: [approvalMode]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mode: { type: string, enum: [NONE, SELF, EXTERNAL] }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.put(
  '/',
  requirePermission('settings:manage'),
  asyncRoute(async (req, res) => {
    const { organizationId, userId } = requestContext(req);
    const { mode } = SetOrganizationModeSchema.parse(req.body);
    const updated = await ApprovalModeService.setOrganizationMode(organizationId, mode, userId);
    res.json({ success: true, data: { organizationMode: updated } });
  })
);

/**
 * @swagger
 * /api/v1/approval-mode/members/{userId}:
 *   put:
 *     summary: setMemberApprovalMode
 *     description: Override one member's mode; null inherits the organization's.
 *     operationId: putApprovalModeMember
 *     tags: [approvalMode]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.put(
  '/members/:userId',
  requirePermission('users:manage'),
  asyncRoute(async (req, res) => {
    const { organizationId, userId } = requestContext(req);
    const targetUserId = z.string().uuid().parse(req.params.userId);
    const { mode } = SetMemberModeSchema.parse(req.body);
    const view = await ApprovalModeService.setMemberMode(
      organizationId,
      targetUserId,
      mode,
      userId
    );
    res.json({ success: true, data: view });
  })
);

export default router;
