import { Router } from 'express';
import { AuthController } from './auth.controller';

const router = Router();
const controller = new AuthController();

/**
 * @swagger
 * /api/v1/identity/auth/login:
 *   post:
 *     summary: Sign in
 *     operationId: postIdentityAuthLogin
 *     tags: [Identity Authentication]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/login', controller.login);
/**
 * @swagger
 * /api/v1/identity/auth/login/mfa:
 *   post:
 *     summary: Complete MFA challenge
 *     operationId: postIdentityAuthLoginMfa
 *     tags: [Identity Authentication]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/login/mfa', controller.mfa);
/**
 * @swagger
 * /api/v1/identity/auth/refresh:
 *   post:
 *     summary: Refresh tokens
 *     operationId: postIdentityAuthRefresh
 *     tags: [Identity Authentication]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/refresh', controller.refresh);

export default router;
