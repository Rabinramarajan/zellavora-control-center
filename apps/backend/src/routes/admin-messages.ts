import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { wrapResponse } from './admin-helpers';

const router = Router();

/**
 * @swagger
 * /api/v1/admin/message/send:
 *   post:
 *     summary: sendMessage
 *     tags: [message]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recipientId, body]
 *             properties:
 *               recipientId:
 *                 type: integer
 *                 example: 1
 *               body:
 *                 type: string
 *                 example: Hello
 *     responses:
 *       200:
 *         description: Message status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     messageId: { type: integer }
 *                     status: { type: string }
 *                     recipientId: { type: integer }
 *                     body: { type: string }
 *                     timestamp: { type: string, format: date-time }
 *                 infoMessage:
 *                   type: object
 *                   properties:
 *                     msgID: { type: integer }
 *                     msgType: { type: string }
 *                     msgDescription: { type: string }
 *                 errorMessage:
 *                   type: array
 *                   items: { type: string }
 *                 hasError:
 *                   type: boolean
 * /api/v1/admin/email/send:
 *   post:
 *     summary: sendEmailCommunication
 *     tags: [emailCommunication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [toEmail, subject, content]
 *             properties:
 *               toEmail:
 *                 type: string
 *                 format: email
 *               subject:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     emailId: { type: integer }
 *                     status: { type: string }
 *                     toEmail: { type: string }
 *                     subject: { type: string }
 *                     timestamp: { type: string, format: date-time }
 *                 infoMessage:
 *                   type: object
 *                   properties:
 *                     msgID: { type: integer }
 *                     msgType: { type: string }
 *                     msgDescription: { type: string }
 *                 errorMessage:
 *                   type: array
 *                   items: { type: string }
 *                 hasError:
 *                   type: boolean
 */

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
