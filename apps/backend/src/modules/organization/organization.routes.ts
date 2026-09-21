import { Router } from 'express';
import { OrganizationController } from './organization.controller';

const router = Router();
const controller = new OrganizationController();

/**
 * @swagger
 * /api/v1/organizations/{id}:
 *   get:
 *     summary: Get organization by ID
 *     operationId: getOrganizationsById
 *     tags: [Organizations]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/:id', controller.get);
/**
 * @swagger
 * /api/v1/organizations:
 *   post:
 *     summary: Create organization
 *     operationId: postOrganizations
 *     tags: [Organizations]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/', controller.create);
/**
 * @swagger
 * /api/v1/organizations/{id}:
 *   put:
 *     summary: Update organization
 *     operationId: putOrganizationsById
 *     tags: [Organizations]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.put('/:id', controller.update);

export default router;
