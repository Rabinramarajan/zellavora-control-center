import { Router } from 'express';
import { SettingsController } from './settings.controller';

const router = Router();
const controller = new SettingsController();

/**
 * @swagger
 * /api/v1/organization-settings:
 *   get:
 *     summary: listOrganizationSettings
 *     operationId: getOrganizationSettings
 *     tags: [organization-settings]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/', controller.list);
/**
 * @swagger
 * /api/v1/organization-settings/{key}:
 *   get:
 *     summary: getOrganizationSettingByKey
 *     operationId: getOrganizationSettingsByKey
 *     tags: [organization-settings]
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
router.get('/:key', controller.get);
/**
 * @swagger
 * /api/v1/organization-settings:
 *   post:
 *     summary: saveOrganizationSetting
 *     operationId: postOrganizationSettings
 *     tags: [organization-settings]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/', controller.save);

export default router;
