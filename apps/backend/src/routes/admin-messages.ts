import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { wrapResponse } from './admin-helpers';

const router = Router();

router.post('/message/send', authenticate, async (req, res, next) => {
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

router.post('/email/send', authenticate, async (req, res, next) => {
  try {
    const { toEmail, subject, content } = req.body;
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
