import { Router } from 'express';
import { IamUserController } from './iam-user.controller';
import { authenticate, requirePermission } from '../../middleware/auth';

const router = Router();
const controller = new IamUserController();

/**
 * @swagger
 * tags:
 *   name: IAM - Users
 *   description: IAM user directory, status and RBAC assignments.
 */

/**
 * @swagger
 * /api/v1/iam/users:
 *   get:
 *     summary: List users
 *     operationId: getIamUsers
 *     description: Paginated, filterable list of users in the directory.
 *     tags: [IAM - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE, LOCKED, PENDING, SUSPENDED] }
 *       - in: query
 *         name: roleId
 *         schema: { type: string }
 *       - in: query
 *         name: groupId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated user list
 */
router.get('/', authenticate, requirePermission('users:read'), controller.list);

/**
 * @swagger
 * /api/v1/iam/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     operationId: getIamUsersById
 *     description: Full user detail including role and group assignments.
 *     tags: [IAM - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User detail
 */
router.get('/:id', authenticate, requirePermission('users:read'), controller.getById);

/**
 * @swagger
 * /api/v1/iam/users:
 *   post:
 *     summary: Create user
 *     operationId: postIamUsers
 *     description: Create a user (optionally as an invitation pending onboarding).
 *     tags: [IAM - Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, fullName]
 *             properties:
 *               email: { type: string, format: email }
 *               username: { type: string, nullable: true }
 *               fullName: { type: string }
 *               firstName: { type: string, nullable: true }
 *               lastName: { type: string, nullable: true }
 *               mobile: { type: string, nullable: true }
 *               department: { type: string, nullable: true }
 *               jobTitle: { type: string, nullable: true }
 *               sendInvite: { type: boolean, default: true }
 *               roleIds:
 *                 type: array
 *                 items: { type: string }
 *               groupIds:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       201:
 *         description: User created
 */
router.post('/', authenticate, requirePermission('users:manage'), controller.create);

/**
 * @swagger
 * /api/v1/iam/users/{id}:
 *   patch:
 *     summary: Update user
 *     operationId: patchIamUsersById
 *     description: Update user profile metadata and status.
 *     tags: [IAM - Users]
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
 *               fullName: { type: string }
 *               firstName: { type: string, nullable: true }
 *               lastName: { type: string, nullable: true }
 *               mobile: { type: string, nullable: true }
 *               department: { type: string, nullable: true }
 *               jobTitle: { type: string, nullable: true }
 *               timezone: { type: string, nullable: true }
 *               language: { type: string }
 *               status: { type: string, enum: [ACTIVE, INACTIVE, LOCKED, PENDING, SUSPENDED] }
 *     responses:
 *       200:
 *         description: User updated
 */
router.patch('/:id', authenticate, requirePermission('users:manage'), controller.update);

/**
 * @swagger
 * /api/v1/iam/users/{id}/status:
 *   put:
 *     summary: Set user status
 *     operationId: putIamUsersByIdStatus
 *     description: Transition a user's lifecycle status.
 *     tags: [IAM - Users]
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [ACTIVE, INACTIVE, LOCKED, PENDING, SUSPENDED] }
 *               reason: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: User status updated
 */
router.put('/:id/status', authenticate, requirePermission('users:manage'), controller.setStatus);

/**
 * @swagger
 * /api/v1/iam/users/{id}/lock:
 *   post:
 *     summary: Lock user
 *     operationId: postIamUsersByIdLock
 *     description: Lock a user account.
 *     tags: [IAM - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: User locked
 */
router.post('/:id/lock', authenticate, requirePermission('users:manage'), controller.lock);

/**
 * @swagger
 * /api/v1/iam/users/{id}/unlock:
 *   post:
 *     summary: Unlock user
 *     operationId: postIamUsersByIdUnlock
 *     description: Unlock a user account.
 *     tags: [IAM - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User unlocked
 */
router.post('/:id/unlock', authenticate, requirePermission('users:manage'), controller.unlock);

/**
 * @swagger
 * /api/v1/iam/users/{id}/roles:
 *   put:
 *     summary: Set user roles
 *     operationId: putIamUsersByIdRoles
 *     description: Set a user's role assignments (replace or merge).
 *     tags: [IAM - Users]
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
 *               roleIds:
 *                 type: array
 *                 items: { type: string }
 *               organizationId: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: User roles updated
 */
router.put('/:id/roles', authenticate, requirePermission('users:manage'), controller.setRoles);

/**
 * @swagger
 * /api/v1/iam/users/{id}/groups:
 *   put:
 *     summary: Set user groups
 *     operationId: putIamUsersByIdGroups
 *     description: Set a user's group memberships (replace or merge).
 *     tags: [IAM - Users]
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
 *               groupIds:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: User groups updated
 */
router.put('/:id/groups', authenticate, requirePermission('users:manage'), controller.setGroups);

/**
 * @swagger
 * /api/v1/iam/users/{id}:
 *   delete:
 *     summary: Delete user
 *     operationId: deleteIamUsersById
 *     description: Soft-delete a user (the platform owner is protected).
 *     tags: [IAM - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User deleted
 */
router.delete('/:id', authenticate, requirePermission('users:manage'), controller.delete);

export default router;
