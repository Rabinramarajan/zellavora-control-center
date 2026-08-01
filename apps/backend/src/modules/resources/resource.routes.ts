import { Router } from 'express';
import { ResourceController } from './resource.controller';
import { authenticate, requirePermission } from '../../middleware/auth';

const router = Router();
const controller = new ResourceController();

/**
 * @swagger
 * tags:
 *   name: resources
 *   description: IAM protected resources and their actions.
 */

/**
 * @swagger
 * /api/v1/iam/resources:
 *   get:
 *     summary: listResources
 *     description: Paginated, filterable list of IAM resources.
 *     tags: [resources]
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
 *         description: Paginated resource list
 */
router.get('/', authenticate, requirePermission('resources:read'), controller.list);

/**
 * @swagger
 * /api/v1/iam/resources/tree:
 *   get:
 *     summary: listResourcesTree
 *     description: Hierarchical resource tree (parent/children).
 *     tags: [resources]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Nested resource tree
 */
router.get('/tree', authenticate, requirePermission('resources:read'), controller.tree);

/**
 * @swagger
 * /api/v1/iam/resources/key/{key}:
 *   get:
 *     summary: getResourceByKey
 *     description: Look up a resource by its unique key (cached).
 *     tags: [resources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Resource summary
 */
router.get('/key/:key', authenticate, requirePermission('resources:read'), controller.getByKey);

/**
 * @swagger
 * /api/v1/iam/resources/{id}:
 *   get:
 *     summary: getResourceById
 *     description: Full resource detail including actions and parent chain.
 *     tags: [resources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Resource detail
 */
router.get('/:id', authenticate, requirePermission('resources:read'), controller.getById);

/**
 * @swagger
 * /api/v1/iam/resources:
 *   post:
 *     summary: createResource
 *     description: Create a resource. Provided actions auto-create permission rows.
 *     tags: [resources]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, key]
 *             properties:
 *               name: { type: string }
 *               key: { type: string }
 *               type: { type: string, enum: [API, FEATURE, DATA, MENU, REPORT, INTEGRATION] }
 *               category: { type: string, nullable: true }
 *               description: { type: string, nullable: true }
 *               parentId: { type: string, nullable: true }
 *               actions:
 *                 type: array
 *                 items: { type: object, properties: { action: { type: string } } }
 *     responses:
 *       201:
 *         description: Resource created
 */
router.post('/', authenticate, requirePermission('resources:manage'), controller.create);

/**
 * @swagger
 * /api/v1/iam/resources/{id}:
 *   patch:
 *     summary: updateResource
 *     description: Update resource metadata.
 *     tags: [resources]
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
 *               category: { type: string, nullable: true }
 *               description: { type: string, nullable: true }
 *               parentId: { type: string, nullable: true }
 *               ownerId: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Resource updated
 */
router.patch('/:id', authenticate, requirePermission('resources:manage'), controller.update);

/**
 * @swagger
 * /api/v1/iam/resources/{id}/actions:
 *   post:
 *     summary: addResourceAction
 *     description: Add an action to a resource (auto-creates its permission).
 *     tags: [resources]
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
 *             required: [action]
 *             properties:
 *               action: { type: string }
 *     responses:
 *       201:
 *         description: Action added
 */
router.post('/:id/actions', authenticate, requirePermission('resources:manage'), controller.addAction);

/**
 * @swagger
 * /api/v1/iam/resources/{id}/actions/{actionId}:
 *   delete:
 *     summary: removeResourceAction
 *     description: Remove an action and its mapped permission.
 *     tags: [resources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: actionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Action removed
 */
router.delete(
  '/:id/actions/:actionId',
  authenticate,
  requirePermission('resources:manage'),
  controller.removeAction
);

/**
 * @swagger
 * /api/v1/iam/resources/{id}:
 *   delete:
 *     summary: deleteResource
 *     description: Soft-delete a resource (system resources are protected).
 *     tags: [resources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Resource deleted
 */
router.delete('/:id', authenticate, requirePermission('resources:manage'), controller.delete);

export default router;
