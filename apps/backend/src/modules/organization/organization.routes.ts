import { Router } from 'express';
import { OrganizationController } from './organization.controller';
import { authenticate, requirePermission, requirePlatformAdmin } from '../../middleware/auth';

const router = Router();
const controller = new OrganizationController();

router.use(authenticate);

/**
 * @swagger
 * /api/v1/organizations/{id}:
 *   get:
 *     summary: getOrganizationById
 *     operationId: getOrganizationsById
 *     tags: [organizations]
 *     description: Returns the caller's own organization. Other ids return 404 unless the caller is a platform administrator.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/:id', requirePermission('organizations:read'), controller.get);
/**
 * @swagger
 * /api/v1/organizations:
 *   post:
 *     summary: createOrganization
 *     operationId: postOrganizations
 *     tags: [organizations]
 *     description: Platform administrators only.
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/', requirePlatformAdmin, controller.create);
/**
 * @swagger
 * /api/v1/organizations/{id}:
 *   put:
 *     summary: updateOrganization
 *     operationId: putOrganizationsById
 *     tags: [organizations]
 *     description: Updates the caller's own organization. Only a platform administrator can turn off two-factor enforcement.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.put('/:id', requirePermission('organizations:update'), controller.update);

export default router;
