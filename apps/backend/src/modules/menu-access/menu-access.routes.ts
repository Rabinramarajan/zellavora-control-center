import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
import { MenuAccessController } from './menu-access.controller';

const router = Router();
const controller = new MenuAccessController();

/**
 * @swagger
 * /api/v1/iam/menu-access/tree:
 *   get:
 *     summary: getMenuTree
 *     operationId: getIamMenuAccessTree
 *     description: The full sidebar menu (groups and sub-menus) with each entry's required permission.
 *     tags: [iamMenuAccess]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Menu tree
 */
router.get('/tree', authenticate, requirePermission('roles:read'), controller.tree);

/**
 * @swagger
 * /api/v1/iam/menu-access/roles/{roleId}:
 *   get:
 *     summary: getRoleMenuAccess
 *     operationId: getIamMenuAccessRole
 *     description: Whether the role's sidebar is restricted, which menu keys it is granted, and its other permissions.
 *     tags: [iamMenuAccess]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: The role's menu access
 *       404:
 *         description: Role not found in this organization
 *   put:
 *     summary: setRoleMenuAccess
 *     operationId: putIamMenuAccessRole
 *     description: >
 *       Replace the role's navigation grants. Only navigation:* permissions
 *       change. System roles may gain entries but not lose them.
 *     tags: [iamMenuAccess]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [restricted, keys]
 *             properties:
 *               restricted: { type: boolean }
 *               keys: { type: array, items: { type: string }, example: [freelancer, dashboard] }
 *     responses:
 *       200:
 *         description: The saved menu access
 *       400:
 *         description: Unknown menu key
 *       403:
 *         description: Would remove access from a system role
 */
router.get('/roles/:roleId', authenticate, requirePermission('roles:read'), controller.get);
router.put('/roles/:roleId', authenticate, requirePermission('roles:manage'), controller.update);

export default router;
