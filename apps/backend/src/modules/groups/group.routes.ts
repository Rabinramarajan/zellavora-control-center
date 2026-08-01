import { Router } from 'express';
import { GroupController } from './group.controller';
import { authenticate, requirePermission } from '../../middleware/auth';

const router = Router();
const controller = new GroupController();

/**
 * @swagger
 * tags:
 *   name: groups
 *   description: IAM groups, membership and group-level roles.
 */

/**
 * @swagger
 * /api/v1/iam/groups:
 *   get:
 *     summary: listGroups
 *     description: Paginated, filterable list of IAM groups.
 *     tags: [groups]
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
 *         description: Paginated group list
 */
router.get('/', authenticate, requirePermission('groups:read'), controller.list);

/**
 * @swagger
 * /api/v1/iam/groups/tree:
 *   get:
 *     summary: listGroupsTree
 *     description: Hierarchical group tree (parent/children).
 *     tags: [groups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Nested group tree
 */
router.get('/tree', authenticate, requirePermission('groups:read'), controller.tree);

/**
 * @swagger
 * /api/v1/iam/groups/{id}:
 *   get:
 *     summary: getGroupById
 *     description: Full group detail including members and roles.
 *     tags: [groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Group detail
 */
router.get('/:id', authenticate, requirePermission('groups:read'), controller.getById);

/**
 * @swagger
 * /api/v1/iam/groups:
 *   post:
 *     summary: createGroup
 *     description: Create a group. Slug is derived from the name.
 *     tags: [groups]
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
 *               type: { type: string, enum: [SECURITY, ORG, DISTRIBUTION, PROJECT, DYNAMIC], default: SECURITY }
 *               status: { type: string, enum: [ACTIVE, INACTIVE], default: ACTIVE }
 *               parentId: { type: string, nullable: true }
 *               ownerId: { type: string, nullable: true }
 *               memberIds:
 *                 type: array
 *                 items: { type: string }
 *               roleIds:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       201:
 *         description: Group created
 */
router.post('/', authenticate, requirePermission('groups:manage'), controller.create);

/**
 * @swagger
 * /api/v1/iam/groups/{id}:
 *   patch:
 *     summary: updateGroup
 *     description: Update group metadata and hierarchy.
 *     tags: [groups]
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
 *               parentId: { type: string, nullable: true }
 *               ownerId: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Group updated
 */
router.patch('/:id', authenticate, requirePermission('groups:manage'), controller.update);

/**
 * @swagger
 * /api/v1/iam/groups/{id}:
 *   delete:
 *     summary: deleteGroup
 *     description: Soft-delete a group (system groups and groups with children are protected).
 *     tags: [groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Group deleted
 */
router.delete('/:id', authenticate, requirePermission('groups:manage'), controller.delete);

/**
 * @swagger
 * /api/v1/iam/groups/{id}/members:
 *   post:
 *     summary: addGroupMembers
 *     description: Add users to a group (idempotent).
 *     tags: [groups]
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
 *             required: [userIds]
 *             properties:
 *               userIds:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       201:
 *         description: Members added
 */
router.post('/:id/members', authenticate, requirePermission('groups:manage'), controller.addMembers);

/**
 * @swagger
 * /api/v1/iam/groups/{id}/members/{userId}:
 *   delete:
 *     summary: removeGroupMember
 *     description: Remove a user from a group.
 *     tags: [groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Member removed
 */
router.delete('/:id/members/:userId', authenticate, requirePermission('groups:manage'), controller.removeMember);

/**
 * @swagger
 * /api/v1/iam/groups/{id}/roles:
 *   put:
 *     summary: setGroupRoles
 *     description: Set the roles attached to a group (replace or merge).
 *     tags: [groups]
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
 *     responses:
 *       200:
 *         description: Group roles updated
 */
router.put('/:id/roles', authenticate, requirePermission('groups:manage'), controller.setRoles);

export default router;
