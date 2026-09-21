import { Router } from 'express';
import { PermissionController } from './permission.controller';

const router = Router();
const controller = new PermissionController();

/**
 * @swagger
 * /api/v1/permissions:
 *   get:
 *     summary: List permissions
 *     operationId: getPermissions
 *     tags: [Permissions]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/', controller.list);
/**
 * @swagger
 * /api/v1/permissions:
 *   post:
 *     summary: Create permission
 *     operationId: postPermissions
 *     tags: [Permissions]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/', controller.create);
/**
 * @swagger
 * /api/v1/permissions/assign:
 *   post:
 *     summary: Assign permission
 *     operationId: postPermissionsAssign
 *     tags: [Permissions]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/assign', controller.assign);

export default router;
