import { Router } from 'express';
import { RoleController } from './role.controller';
import { authenticate, requirePermission } from '../../middleware/auth';

const router = Router();
const controller = new RoleController();

/**
 * @swagger
 * tags:
 *   name: roles
 *   description: IAM roles and their permission assignments.
 */

/**
 * @swagger
 * /api/v1/iam/roles:
 *   get:
 *     summary: listRoles
 *     description: Paginated, filterable list of IAM roles.
 *     tags: [roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated role list
 */
router.get('/', authenticate, requirePermission('roles:read'), controller.list);

/**
 * @swagger
 * /api/v1/iam/roles/all:
 *   get:
 *     summary: listAllRoles
 *     description: Unpaginated role list (for dropdowns and assignment pickers).
 *     tags: [roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All roles
 */
router.get('/all', authenticate, requirePermission('roles:read'), controller.listAll);

/**
 * @swagger
 * /api/v1/iam/roles/{id}:
 *   get:
 *     summary: getRoleById
 *     description: Full role detail including its permission matrix.
 *     tags: [roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role detail
 */
router.get('/:id', authenticate, requirePermission('roles:read'), controller.getById);

/**
 * @swagger
 * /api/v1/iam/roles/{id}/permissions:
 *   get:
 *     summary: listRolePermissions
 *     description: Permission matrix currently granted to a role.
 *     tags: [roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Permission list
 */
router.get('/:id/permissions', authenticate, requirePermission('roles:read'), controller.listPermissions);

/**
 * @swagger
 * /api/v1/iam/roles:
 *   post:
 *     summary: createRole
 *     description: Create a role. Key is derived from the name.
 *     tags: [roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string, nullable: true }
 *               scope: { type: string, enum: [GLOBAL, ORG, RESOURCE], default: ORG }
 *               status: { type: string, enum: [ACTIVE, INACTIVE], default: ACTIVE }
 *               organizationId: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Role created
 */
router.post('/', authenticate, requirePermission('roles:manage'), controller.create);

/**
 * @swagger
 * /api/v1/iam/roles/{id}:
 *   patch:
 *     summary: updateRole
 *     description: Update role metadata.
 *     tags: [roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string, nullable: true }
 *               status: { type: string, enum: [ACTIVE, INACTIVE] }
 *     responses:
 *       200:
 *         description: Role updated
 */
router.patch('/:id', authenticate, requirePermission('roles:manage'), controller.update);

/**
 * @swagger
 * /api/v1/iam/roles/{id}:
 *   delete:
 *     summary: deleteRole
 *     description: Soft-delete a role (system roles are protected).
 *     tags: [roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role deleted
 */
router.delete('/:id', authenticate, requirePermission('roles:manage'), controller.delete);

/**
 * @swagger
 * /api/v1/iam/roles/{id}/permissions:
 *   put:
 *     summary: setRolePermissions
 *     description: Set the role's permission matrix (replace or merge).
 *     tags: [roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mode: { type: string, enum: [replace, merge], default: replace }
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [permissionId, effect]
 *                   properties:
 *                     permissionId: { type: string }
 *                     effect: { type: string, enum: [allow, deny] }
 *     responses:
 *       200:
 *         description: Updated permission matrix
 */
router.put('/:id/permissions', authenticate, requirePermission('roles:manage'), controller.setPermissions);

/**
 * @swagger
 * /api/v1/iam/roles/{id}/copy:
 *   post:
 *     summary: copyRole
 *     description: Clone a role, optionally copying its permissions.
 *     tags: [roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string, nullable: true }
 *               includePermissions: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Role cloned
 */
router.post('/:id/copy', authenticate, requirePermission('roles:manage'), controller.copy);

export default router;
