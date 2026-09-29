import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
import { SettingsController } from './settings.controller';

const router = Router();
const controller = new SettingsController();

/**
 * @swagger
 * /api/v1/organization-settings:
 *   get:
 *     summary: listOrganizationSettings
 *     operationId: getOrganizationSettings
 *     tags: [organizationSettings]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/', authenticate, controller.list);
/**
 * @swagger
 * /api/v1/organization-settings/{key}:
 *   get:
 *     summary: getOrganizationSettingByKey
 *     operationId: getOrganizationSettingsByKey
 *     tags: [organizationSettings]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/:key', authenticate, controller.get);
/**
 * @swagger
 * /api/v1/organization-settings:
 *   post:
 *     summary: saveOrganizationSetting
 *     operationId: postOrganizationSettings
 *     tags: [organizationSettings]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/', authenticate, requirePermission('settings:write'), controller.save);

export default router;
