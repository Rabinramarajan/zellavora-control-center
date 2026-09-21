import { Router } from 'express';
import { NotificationController } from './notification.controller';

const router = Router();
const controller = new NotificationController();

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: listNotifications
 *     operationId: getNotifications
 *     tags: [notifications]
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
 *     summary: sendNotification
 *     operationId: postNotificationsSend
 *     tags: [notifications]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/send', controller.send);

export default router;
