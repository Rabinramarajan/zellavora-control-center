import { Router } from 'express';
import { OrganizationController } from './organization.controller';

const router = Router();
const controller = new OrganizationController();

/**
 * @swagger
 * /api/v1/organizations/{id}:
 *   get:
 *     summary: getOrganizationById
 *     operationId: getOrganizationsById
 *     tags: [organizations]
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
 *     summary: createOrganization
 *     operationId: postOrganizations
 *     tags: [organizations]
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
 *     summary: updateOrganization
 *     operationId: putOrganizationsById
 *     tags: [organizations]
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
