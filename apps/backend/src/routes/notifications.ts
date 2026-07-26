import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { NotificationService } from '../services/notification.service';

export function createNotificationRoutes(notificationService: NotificationService): Router {
  const router = Router();

  // ========================================
  // Send Notifications
  // ========================================

  /**
   * POST /api/v1/notifications/send
   * Send notification
   */
  /**
   * @swagger
   * /api/v1/notifications/send:
   *   post:
   *     summary: Send a notification via one or more channels
   *     tags: [Notifications]
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [body, channels]
   *             properties:
   *               templateKey:
   *                 type: string
   *               recipientId:
   *                 type: string
   *                 format: uuid
   *               recipientEmail:
   *                 type: string
   *                 format: email
   *               title:
   *                 type: string
   *               body:
   *                 type: string
   *               actionUrl:
   *                 type: string
   *               channels:
   *                 type: array
   *                 items:
   *                   type: string
   *                   enum: [email, sms, whatsapp, push, in_app]
   *               category:
   *                 type: string
   *               priority:
   *                 type: integer
   *                 minimum: 0
   *                 maximum: 100
   *               scheduledFor:
   *                 type: string
   *                 format: date-time
   *               variables:
   *                 type: object
   *     responses:
   *       200:
   *         description: Notification sent
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Notification'
   *       400:
   *         description: Failed to send notification
   *       401:
   *         description: Unauthorized
   */
  router.post('/send', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        templateKey: z.string().optional(),
        recipientId: z.string().uuid().optional(),
        recipientEmail: z.string().email().optional(),
        title: z.string().optional(),
        body: z.string(),
        actionUrl: z.string().url().optional(),
        channels: z.array(z.enum(['email', 'sms', 'whatsapp', 'push', 'in_app'])),
        category: z.string().optional(),
        priority: z.number().min(0).max(100).optional(),
        scheduledFor: z.string().datetime().optional(),
        variables: z.record(z.any()).optional(),
      });

      const body = schema.parse(req.body);
      const organizationId = (req as any).user?.organizationId;
      const userId = (req as any).user?.id;

      if (!organizationId) return res.status(401).json({ error: 'Not authorized' });

      const notification = await notificationService.sendNotification(
        organizationId,
        {
          ...body,
          scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
        } as any,
        userId
      );

      if (!notification) {
        return res.status(400).json({ error: 'Failed to send notification' });
      }

      res.status(201).json(notification);
    } catch (error) {
      console.error('Failed to send notification', error);
      res.status(500).json({ error: 'Failed to send notification' });
    }
  });

  /**
   * POST /api/v1/notifications/send-bulk
   * Send bulk notifications
   */
  router.post('/send-bulk', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        recipientIds: z.array(z.string().uuid()),
        templateKey: z.string().optional(),
        title: z.string().optional(),
        body: z.string(),
        channels: z.array(z.enum(['email', 'sms', 'whatsapp', 'push', 'in_app'])),
        category: z.string().optional(),
        priority: z.number().min(0).max(100).optional(),
        variables: z.record(z.any()).optional(),
      });

      const body = schema.parse(req.body);
      const organizationId = (req as any).user?.organizationId;
      const userId = (req as any).user?.id;

      if (!organizationId) return res.status(401).json({ error: 'Not authorized' });

      const notificationIds = await notificationService.sendBulkNotifications(
        organizationId,
        body.recipientIds,
        {
          templateKey: body.templateKey,
          title: body.title,
          body: body.body,
          channels: body.channels,
          category: body.category,
          priority: body.priority,
          variables: body.variables,
        },
        userId
      );

      res.status(201).json({ notificationIds });
    } catch (error) {
      console.error('Failed to send bulk notifications', error);
      res.status(500).json({ error: 'Failed to send bulk notifications' });
    }
  });

  // ========================================
  // User Notifications
  // ========================================

  /**
   * GET /api/v1/notifications
   * Get user's notifications
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const organizationId = (req as any).user?.organizationId;
      const userId = (req as any).user?.id;

      if (!organizationId || !userId) return res.status(401).json({ error: 'Not authorized' });

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const unreadOnly = req.query.unreadOnly === 'true';
      const category = req.query.category as string;

      const result = await notificationService.getUserNotifications(organizationId, userId, {
        limit,
        offset,
        unreadOnly,
        category,
      });

      res.json(result);
    } catch (error) {
      console.error('Failed to get notifications', error);
      res.status(500).json({ error: 'Failed to get notifications' });
    }
  });

  /**
   * GET /api/v1/notifications/:notificationId
   * Get notification details
   */
  router.get('/:notificationId', async (req: Request, res: Response) => {
    try {
      const notification = await notificationService.getNotification(req.params.notificationId);

      if (!notification) return res.status(404).json({ error: 'Notification not found' });

      // Verify user owns notification
      const userId = (req as any).user?.id;
      if (notification.recipientId !== userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      res.json(notification);
    } catch (error) {
      console.error('Failed to get notification', error);
      res.status(500).json({ error: 'Failed to get notification' });
    }
  });

  /**
   * POST /api/v1/notifications/:notificationId/read
   * Mark notification as read
   */
  router.post('/:notificationId/read', async (req: Request, res: Response) => {
    try {
      const success = await notificationService.markAsRead(req.params.notificationId);

      if (!success) return res.status(400).json({ error: 'Failed to mark as read' });

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to mark as read', error);
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  });

  /**
   * POST /api/v1/notifications/mark-all-read
   * Mark all notifications as read
   */
  router.post('/mark-all-read', async (req: Request, res: Response) => {
    try {
      const organizationId = (req as any).user?.organizationId;
      const userId = (req as any).user?.id;

      if (!organizationId || !userId) return res.status(401).json({ error: 'Not authorized' });

      const success = await notificationService.markAllAsRead(organizationId, userId);

      if (!success) return res.status(400).json({ error: 'Failed to mark all as read' });

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to mark all as read', error);
      res.status(500).json({ error: 'Failed to mark all as read' });
    }
  });

  /**
   * DELETE /api/v1/notifications/:notificationId
   * Delete notification
   */
  router.delete('/:notificationId', async (req: Request, res: Response) => {
    try {
      const success = await notificationService.deleteNotification(req.params.notificationId);

      if (!success) return res.status(400).json({ error: 'Failed to delete' });

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete notification', error);
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  });

  // ========================================
  // Unread Count
  // ========================================

  /**
   * GET /api/v1/notifications/unread/count
   * Get unread notification count
   */
  router.get('/unread/count', async (req: Request, res: Response) => {
    try {
      const organizationId = (req as any).user?.organizationId;
      const userId = (req as any).user?.id;

      if (!organizationId || !userId) return res.status(401).json({ error: 'Not authorized' });

      const count = await notificationService.getUnreadCount(organizationId, userId);

      res.json({ unreadCount: count });
    } catch (error) {
      console.error('Failed to get unread count', error);
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  });

  // ========================================
  // Preferences
  // ========================================

  /**
   * GET /api/v1/notifications/preferences
   * Get notification preferences
   */
  router.get('/preferences', async (req: Request, res: Response) => {
    try {
      const organizationId = (req as any).user?.organizationId;
      const userId = (req as any).user?.id;

      if (!organizationId || !userId) return res.status(401).json({ error: 'Not authorized' });

      const preferences = await notificationService.getPreferences(organizationId, userId);

      res.json(preferences);
    } catch (error) {
      console.error('Failed to get preferences', error);
      res.status(500).json({ error: 'Failed to get preferences' });
    }
  });

  /**
   * PUT /api/v1/notifications/preferences
   * Update notification preferences
   */
  router.put('/preferences', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        notificationsEnabled: z.boolean().optional(),
        emailEnabled: z.boolean().optional(),
        smsEnabled: z.boolean().optional(),
        whatsappEnabled: z.boolean().optional(),
        pushEnabled: z.boolean().optional(),
        inAppEnabled: z.boolean().optional(),
        emailFrequency: z.enum(['instant', 'hourly', 'daily', 'weekly', 'off']).optional(),
        unsubscribedCategories: z.array(z.string()).optional(),
      });

      const body = schema.parse(req.body);
      const organizationId = (req as any).user?.organizationId;
      const userId = (req as any).user?.id;

      if (!organizationId || !userId) return res.status(401).json({ error: 'Not authorized' });

      const success = await notificationService.updatePreferences(organizationId, userId, body);

      if (!success) return res.status(400).json({ error: 'Failed to update preferences' });

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to update preferences', error);
      res.status(500).json({ error: 'Failed to update preferences' });
    }
  });

  // ========================================
  // Templates
  // ========================================

  /**
   * GET /api/v1/notifications/templates
   * Get all notification templates
   */
  router.get('/templates', async (req: Request, res: Response) => {
    try {
      const organizationId = (req as any).user?.organizationId;

      if (!organizationId) return res.status(401).json({ error: 'Not authorized' });

      const { data: templates, error } = await (req as any).supabase
        .from('notification_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('enabled', true);

      if (error) throw error;

      res.json(templates || []);
    } catch (error) {
      console.error('Failed to get templates', error);
      res.status(500).json({ error: 'Failed to get templates' });
    }
  });

  // ========================================
  // Audit Logs
  // ========================================

  /**
   * GET /api/v1/notifications/:notificationId/audit-logs
   * Get notification audit logs
   */
  router.get('/:notificationId/audit-logs', async (req: Request, res: Response) => {
    try {
      const logs = await notificationService.getAuditLogs(req.params.notificationId, {
        limit: 100,
      });

      res.json(logs);
    } catch (error) {
      console.error('Failed to get audit logs', error);
      res.status(500).json({ error: 'Failed to get audit logs' });
    }
  });

  // ========================================
  // Queue Processing (Internal)
  // ========================================

  /**
   * POST /api/v1/notifications/process-queue
   * Process notification queue (internal/cron)
   */
  router.post('/process-queue', async (req: Request, res: Response) => {
    try {
      // Verify internal request
      const apiKey = req.headers['x-api-key'];
      if (apiKey !== process.env.INTERNAL_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await notificationService.processQueue();

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to process queue', error);
      res.status(500).json({ error: 'Failed to process queue' });
    }
  });

  return router;
}
