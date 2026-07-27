import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { wrapResponse } from './admin-helpers';

const router = Router();

/**
 * @swagger
 * /api/v1/admin/message/send:
 *   post:
 *     summary: Send message
 *     tags: [Message]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Message status
 * /api/v1/admin/email/send:
 *   post:
 *     summary: Send email communication
 *     tags: [Email Communication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Email status
 */

router.post('/message/send', authenticate, async (req, res, next) => {
  try {
    const { recipientId, body } = req.body;
    res.json(wrapResponse({
      messageId: 1,
      status: 'Sent',
      recipientId,
      body,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    next(error);
  }
});

router.post('/email/send', authenticate, async (req, res, next) => {
  try {
    const { toEmail, subject, content } = req.body;
    res.json(wrapResponse({
      emailId: 1,
      status: 'Queued',
      toEmail,
      subject,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    next(error);
  }
});

export default router;
