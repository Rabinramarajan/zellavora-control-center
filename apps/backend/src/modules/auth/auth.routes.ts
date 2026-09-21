import { Router } from 'express';
import { AuthController } from './auth.controller';

const router = Router();
const controller = new AuthController();

/**
 * @swagger
 * /api/v1/identity/auth/login:
 *   post:
 *     summary: signIn
 *     operationId: postIdentityAuthLogin
 *     tags: [identityAuthentication]
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
 *     summary: completeMfaChallenge
 *     operationId: postIdentityAuthLoginMfa
 *     tags: [identityAuthentication]
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
 *     summary: refreshTokens
 *     operationId: postIdentityAuthRefresh
 *     tags: [identityAuthentication]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/refresh', controller.refresh);

export default router;
