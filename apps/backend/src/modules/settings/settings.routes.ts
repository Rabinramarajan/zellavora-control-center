import { Router } from 'express';
import { SettingsController } from './settings.controller';

const router = Router();
const controller = new SettingsController();

/**
 * @swagger
 * /api/v1/organization-settings:
 *   get:
 *     summary: List organization settings
 *     operationId: getOrganizationSettings
 *     tags: [Organization Settings]
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
 *     summary: Get organization setting by key
 *     operationId: getOrganizationSettingsByKey
 *     tags: [Organization Settings]
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
 *     summary: Save organization setting
 *     operationId: postOrganizationSettings
 *     tags: [Organization Settings]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/', controller.save);

export default router;
