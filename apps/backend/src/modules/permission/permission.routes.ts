import { Router } from 'express';
import { PermissionController } from './permission.controller';

const router = Router();
const controller = new PermissionController();

/**
 * @swagger
 * /api/v1/permissions:
 *   get:
 *     summary: listPermissions
 *     operationId: getPermissions
 *     tags: [permissions]
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
 *     summary: createPermission
 *     operationId: postPermissions
 *     tags: [permissions]
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
 *     summary: assignPermission
 *     operationId: postPermissionsAssign
 *     tags: [permissions]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/assign', controller.assign);

export default router;
