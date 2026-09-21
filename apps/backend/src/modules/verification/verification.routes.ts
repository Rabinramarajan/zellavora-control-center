import { Router } from 'express';
import { VerificationController } from './verification.controller';

const router = Router();
const controller = new VerificationController();

/**
 * @swagger
 * /api/v1/verifications/send:
 *   post:
 *     summary: sendVerificationChallenge
 *     operationId: postVerificationsSend
 *     tags: [verifications]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/send', controller.send);
/**
 * @swagger
 * /api/v1/verifications/verify:
 *   post:
 *     summary: verifyChallenge
 *     operationId: postVerificationsVerify
 *     tags: [verifications]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/verify', controller.verify);

export default router;
