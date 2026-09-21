import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { wrapResponse } from './admin-helpers';

const router = Router();

/**
 * @swagger
 * /api/v1/admin/messages/send:
 *   post:
 *     summary: sendMessage
 *     operationId: postAdminMessagesSend
 *     tags: [administration-messages]
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post(['/messages/send', '/message/send'], authenticate, async (req, res, next) => {
  try {
    const { recipientId, body } = req.body;
    res.json(
      wrapResponse({
        messageId: 1,
        status: 'Sent',
        recipientId,
        body,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/admin/emails/send:
 *   post:
 *     summary: sendEmail
 *     operationId: postAdminEmailsSend
 *     tags: [administration-messages]
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post(['/emails/send', '/email/send'], authenticate, async (req, res, next) => {
  try {
    const { toEmail, subject } = req.body;
    res.json(
      wrapResponse({
        emailId: 1,
        status: 'Queued',
        toEmail,
        subject,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    next(error);
  }
});

export default router;
