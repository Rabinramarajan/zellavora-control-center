import { Router } from 'express';
import { InvitationController } from './invitation.controller';

const router = Router();
const controller = new InvitationController();

/**
 * @swagger
 * /api/v1/invitations/verify:
 *   post:
 *     summary: Verify invitation
 *     operationId: postInvitationsVerify
 *     tags: [Invitations]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/verify', controller.verify);
/**
 * @swagger
 * /api/v1/invitations/generate:
 *   post:
 *     summary: Generate invitation
 *     operationId: postInvitationsGenerate
 *     tags: [Invitations]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/generate', controller.generate);

export default router;
