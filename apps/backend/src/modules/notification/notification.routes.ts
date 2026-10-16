import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new NotificationController();

router.use(authenticate);

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: listNotifications
 *     operationId: getNotifications
 *     tags: [notifications]
 *     description: Returns the signed-in user's own notifications, newest first.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 25 }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/', controller.list);

export default router;
