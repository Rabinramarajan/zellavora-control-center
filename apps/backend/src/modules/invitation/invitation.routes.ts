import { Router } from 'express';
import { InvitationController } from './invitation.controller';

const router = Router();
const controller = new InvitationController();

/**
 * @swagger
 * /api/v1/invitations/verify:
 *   post:
 *     summary: verifyInvitation
 *     operationId: postInvitationsVerify
 *     tags: [invitations]
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
 *     summary: generateInvitation
 *     operationId: postInvitationsGenerate
 *     tags: [invitations]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/generate', controller.generate);

export default router;
