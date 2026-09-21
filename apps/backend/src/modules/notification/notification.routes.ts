import { Router } from 'express';
import { NotificationController } from './notification.controller';

const router = Router();
const controller = new NotificationController();

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: List notifications
 *     operationId: getNotifications
 *     tags: [Notifications]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/', controller.list);
/**
 * @swagger
 * /api/v1/notifications/send:
 *   post:
 *     summary: Send notification
 *     operationId: postNotificationsSend
 *     tags: [Notifications]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/send', controller.send);

export default router;
