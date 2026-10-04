import { Router, type Response } from 'express';
import { mountSearchRoutes } from '../../infrastructure/search/search';
import { communicationSearch } from './communications.search';
import { authenticate, requirePermission, type AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';
import { orgContextOf } from '../../middleware/org-context';
import { CommunicationsService } from './communications.service';
import { HistoryQuerySchema, SendEmailSchema, SendMessageSchema } from './communications.dto';
import { createRateLimiter, userOrIpKey } from '../../middleware/rate-limit';

const router = Router();
const service = new CommunicationsService();

// Bulk sends are expensive and easy to abuse; cap them per user.
const sendLimiter = createRateLimiter({
  bucket: 'communications:send',
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: userOrIpKey,
});

/**
 * @swagger
 * tags:
 *   name: iamCommunications
 *   description: In-app messages and email to organization members.
 */

/**
 * @swagger
 * /api/v1/iam/communications/messages/search/criteria:
 *   get:
 *     summary: getIamCommunicationsMessagesSearchCriteria
 *     operationId: getIamCommunicationsMessagesSearchCriteria
 *     tags: [iamCommunications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Default search request (filters, pageNumber, pageSize, orderByColumnName, ascending) }
 * /api/v1/iam/communications/messages/search:
 *   post:
 *     summary: searchIamCommunicationsMessages
 *     operationId: postIamCommunicationsMessagesSearch
 *     description: "Filtered, sorted, paginated in-app messages. orderByColumnName: sentAt."
 *     tags: [iamCommunications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: "{ pageNumber, pageSize, totalCount, items, msg }" }
 *       400: { description: Invalid criteria }
 */
/**
 * @swagger
 * /api/v1/iam/communications/emails/search/criteria:
 *   get:
 *     summary: getIamCommunicationsEmailsSearchCriteria
 *     operationId: getIamCommunicationsEmailsSearchCriteria
 *     tags: [iamCommunications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Default search request (filters, pageNumber, pageSize, orderByColumnName, ascending) }
 * /api/v1/iam/communications/emails/search:
 *   post:
 *     summary: searchIamCommunicationsEmails
 *     operationId: postIamCommunicationsEmailsSearch
 *     description: "Filtered, sorted, paginated emails. orderByColumnName: sentAt."
 *     tags: [iamCommunications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: "{ pageNumber, pageSize, totalCount, items, msg }" }
 *       400: { description: Invalid criteria }
 */
const historyGuards = [authenticate, requirePermission('settings:manage')];
mountSearchRoutes(router, communicationSearch('in_app'), historyGuards, '/messages');
mountSearchRoutes(router, communicationSearch('email'), historyGuards, '/emails');

/**
 * @swagger
 * /api/v1/iam/communications/messages:
 *   post:
 *     summary: sendMessage
 *     operationId: postIamCommunicationsMessages
 *     description: Deliver an in-app notification to an audience (all, users, group, team or department).
 *     tags: [iamCommunications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Delivery summary
 */
router.post(
  '/messages',
  authenticate,
  requirePermission('settings:manage'),
  sendLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const dto = SendMessageSchema.parse(req.body);
    res.json({ success: true, data: await service.sendMessage(organizationId, dto, actorId) });
  })
);

/**
 * @swagger
 * /api/v1/iam/communications/emails:
 *   post:
 *     summary: sendEmail
 *     operationId: postIamCommunicationsEmails
 *     description: Email an audience. Each recipient gets an individual message; the body is plain text.
 *     tags: [iamCommunications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Delivery summary
 */
router.post(
  '/emails',
  authenticate,
  requirePermission('settings:manage'),
  sendLimiter,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const dto = SendEmailSchema.parse(req.body);
    res.json({ success: true, data: await service.sendEmail(organizationId, dto, actorId) });
  })
);

/**
 * @swagger
 * /api/v1/iam/communications/history:
 *   get:
 *     summary: listCommunicationHistory
 *     operationId: getIamCommunicationsHistory
 *     tags: [iamCommunications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: channel
 *         required: true
 *         schema: { type: string, enum: [in_app, email] }
 *     responses:
 *       200:
 *         description: Paginated send history
 */
router.get(
  '/history',
  authenticate,
  requirePermission('settings:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = orgContextOf(req);
    const query = HistoryQuerySchema.parse(req.query);
    res.json({ success: true, data: await service.history(organizationId, query) });
  })
);

export default router;
