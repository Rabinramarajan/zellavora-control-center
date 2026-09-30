import { Router } from 'express';
import { PermissionController } from './permission.controller';
import { authenticate, requirePermission } from '../../middleware/auth';

const router = Router();
const controller = new PermissionController();

/**
 * @swagger
 * /api/v1/permissions:
 *   get:
 *     summary: listPermissions
 *     operationId: getPermissions
 *     tags: [permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/', authenticate, controller.list);
/**
 * @swagger
 * /api/v1/permissions:
 *   post:
 *     summary: createPermission
 *     operationId: postPermissions
 *     tags: [permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/', authenticate, requirePermission('roles:manage'), controller.create);
/**
 * @swagger
 * /api/v1/permissions/assign:
 *   post:
 *     summary: assignPermission
 *     operationId: postPermissionsAssign
 *     tags: [permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/assign', authenticate, requirePermission('roles:manage'), controller.assign);

export default router;
