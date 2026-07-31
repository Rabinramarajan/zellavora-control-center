import { createClient } from '@supabase/supabase-js';
import { RedisClient } from '../infrastructure/redis';
import { EventEmitter } from 'events';

export interface NotificationTemplate {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  channels: string[];
  emailSubject?: string;
  emailTemplate?: string;
  smsTemplate?: string;
  whatsappTemplate?: string;
  pushTitle?: string;
  pushBody?: string;
  inAppTitle?: string;
  inAppBody?: string;
  category: string;
  priority: number;
}

export interface Notification {
  id: string;
  organizationId: string;
  recipientId: string;
  templateId?: string;
  title: string;
  subject?: string;
  body: string;
  actionUrl?: string;
  channels: string[];
  status: 'queued' | 'processing' | 'sent' | 'delivered' | 'failed' | 'cancelled';
  read: boolean;
  category: string;
  priority: number;
  scheduledFor?: Date;
  sentAt?: Date;
  readAt?: Date;
}

export interface NotificationPreferences {
  userId: string;
  notificationsEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  quietHoursEnabled: boolean;
  emailFrequency: string;
  unsubscribedCategories: string[];
}

export interface SendNotificationRequest {
  templateKey?: string;
  recipientId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  title?: string;
  subject?: string;
  body?: string;
  actionUrl?: string;
  channels: string[];
  category?: string;
  priority?: number;
  scheduledFor?: Date;
  variables?: Record<string, any>;
}

export class NotificationService extends EventEmitter {
  private supabase: any;
  private redis: RedisClient;
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly UNREAD_COUNT_CACHE = 'unread_count:';

  constructor(supabase: ReturnType<typeof createClient>, redis: RedisClient) {
    super();
    this.supabase = supabase;
    this.redis = redis;
  }

  /**
   * Send notification using template
   */
  async sendNotification(
    organizationId: string,
    request: SendNotificationRequest,
    userId: string
  ): Promise<Notification | null> {
    try {
      // Get template if using template key
      let template: NotificationTemplate | null = null;
      if (request.templateKey) {
        template = await this.getTemplate(organizationId, request.templateKey);
      }

      // Get recipient preferences
      const preferences = await this.getPreferences(organizationId, request.recipientId);

      // Check if user has opted out of category
      if (template?.category && preferences?.unsubscribedCategories?.includes(template.category)) {
        return null; // Silent skip
      }

      // Determine channels to use
      let channels = request.channels;
      if (template && !request.channels?.length) {
        channels = template.channels || ['in_app'];
      }

      // Filter channels based on preferences
      if (preferences) {
        channels = channels.filter((ch) => {
          switch (ch) {
            case 'email':
              return preferences.emailEnabled;
            case 'sms':
              return preferences.smsEnabled;
            case 'whatsapp':
              return preferences.whatsappEnabled;
            case 'push':
              return preferences.pushEnabled;
            case 'in_app':
              return preferences.inAppEnabled;
            default:
              return false;
          }
        });
      }

      if (!channels.length) {
        return null; // No valid channels
      }

      // Render content from template if needed
      let title = request.title || template?.inAppTitle || 'Notification';
      let subject = request.subject || template?.emailSubject || title;
      let body = request.body || template?.inAppBody || '';

      // Render variables
      if (request.variables) {
        title = this.renderTemplate(title, request.variables);
        subject = this.renderTemplate(subject, request.variables);
        body = this.renderTemplate(body, request.variables);
      }

      // Create notification record
      const scheduledFor = request.scheduledFor || new Date();

      const { data: notification, error } = await this.supabase
        .from('notifications')
        .insert({
          organization_id: organizationId,
          template_id: template?.id,
          recipient_id: request.recipientId,
          recipient_email: request.recipientEmail,
          recipient_phone: request.recipientPhone,
          channels,
          title,
          subject,
          body,
          action_url: request.actionUrl,
          category: request.category || template?.category || 'general',
          priority: request.priority ?? template?.priority ?? 50,
          status: scheduledFor > new Date() ? 'scheduled' : 'queued',
          scheduled_for: scheduledFor.toISOString(),
          variables: request.variables || {},
          created_by: userId,
        })
        .select()
        .single();

      if (error || !notification) throw error;

      // Add to queue
      await this.queueNotification(notification.id);

      // Invalidate unread count cache
      if (request.recipientId) {
        await this.invalidateUnreadCountCache(organizationId, request.recipientId);
      }

      // Emit event for realtime
      this.emit('notification:created', {
        id: notification.id,
        organizationId,
        recipientId: request.recipientId,
        channels,
      });

      return this.transformNotification(notification);
    } catch (error) {
      console.error('Failed to send notification', error);
      return null;
    }
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(
    organizationId: string,
    recipientIds: string[],
    request: Omit<SendNotificationRequest, 'recipientId'>,
    userId: string
  ): Promise<string[]> {
    const notificationIds: string[] = [];

    for (const recipientId of recipientIds) {
      const notification = await this.sendNotification(
        organizationId,
        { ...request, recipientId },
        userId
      );
      if (notification) {
        notificationIds.push(notification.id);
      }
    }

    return notificationIds;
  }

  /**
   * Get notification
   */
  async getNotification(notificationId: string): Promise<Notification | null> {
    try {
      const { data: notification, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .single();

      if (error || !notification) return null;

      return this.transformNotification(notification);
    } catch (error) {
      console.error('Failed to get notification', error);
      return null;
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    organizationId: string,
    userId: string,
    options?: { limit?: number; offset?: number; unreadOnly?: boolean; category?: string }
  ): Promise<{ notifications: Notification[]; total: number }> {
    try {
      let query = this.supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('recipient_id', userId)
        .eq('deleted', false);

      if (options?.unreadOnly) {
        query = query.eq('read', false);
      }

      if (options?.category) {
        query = query.eq('category', options.category);
      }

      query = query.order('created_at', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data: notifications, count, error } = await query;

      if (error || !notifications) return { notifications: [], total: 0 };

      return {
        notifications: notifications.map((n) => this.transformNotification(n)),
        total: count || 0,
      };
    } catch (error) {
      console.error('Failed to get notifications', error);
      return { notifications: [], total: 0 };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) throw error;

      // Log audit
      await this.logAudit(notificationId, 'read', {});

      // Emit realtime event
      this.emit('notification:read', { id: notificationId });

      return true;
    } catch (error) {
      console.error('Failed to mark as read', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(organizationId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq('organization_id', organizationId)
        .eq('recipient_id', userId)
        .eq('read', false);

      if (error) throw error;

      // Invalidate cache
      await this.invalidateUnreadCountCache(organizationId, userId);

      return true;
    } catch (error) {
      console.error('Failed to mark all as read', error);
      return false;
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(organizationId: string, userId: string): Promise<number> {
    try {
      const cacheKey = `${this.UNREAD_COUNT_CACHE}${organizationId}:${userId}`;
      const cached = await this.redis.get<number>(cacheKey);
      if (cached !== undefined) return cached;

      const { count, error } = await this.supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('recipient_id', userId)
        .eq('read', false);

      if (error) throw error;

      const unreadCount = count || 0;
      await this.redis.set(cacheKey, unreadCount, this.CACHE_TTL);

      return unreadCount;
    } catch (error) {
      console.error('Failed to get unread count', error);
      return 0;
    }
  }

  /**
   * Get notification template
   */
  async getTemplate(
    organizationId: string,
    templateKey: string
  ): Promise<NotificationTemplate | null> {
    try {
      const cacheKey = `template:${organizationId}:${templateKey}`;
      const cached = await this.redis.get<NotificationTemplate>(cacheKey);
      if (cached) return cached;

      const { data: template, error } = await this.supabase
        .from('notification_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('key', templateKey)
        .eq('enabled', true)
        .single();

      if (error || !template) return null;

      const transformed = this.transformTemplate(template);
      await this.redis.set(cacheKey, transformed, this.CACHE_TTL);

      return transformed;
    } catch (error) {
      console.error('Failed to get template', error);
      return null;
    }
  }

  /**
   * Get user preferences
   */
  async getPreferences(
    organizationId: string,
    userId?: string
  ): Promise<NotificationPreferences | null> {
    if (!userId) return null;

    try {
      const cacheKey = `preferences:${organizationId}:${userId}`;
      const cached = await this.redis.get<NotificationPreferences>(cacheKey);
      if (cached) return cached;

      const { data: preferences, error } = await this.supabase
        .from('notification_preferences')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .single();

      if (error) {
        // Return defaults if not found
        return {
          userId,
          notificationsEnabled: true,
          emailEnabled: true,
          smsEnabled: true,
          whatsappEnabled: true,
          pushEnabled: true,
          inAppEnabled: true,
          quietHoursEnabled: false,
          emailFrequency: 'instant',
          unsubscribedCategories: [],
        };
      }

      const transformed = this.transformPreferences(preferences);
      await this.redis.set(cacheKey, transformed, this.CACHE_TTL);

      return transformed;
    } catch (error) {
      console.error('Failed to get preferences', error);
      return null;
    }
  }

  /**
   * Update preferences
   */
  async updatePreferences(
    organizationId: string,
    userId: string,
    updates: Partial<NotificationPreferences>
  ): Promise<boolean> {
    try {
      // Prepare update data
      const updateData: Record<string, any> = {};

      if (updates.notificationsEnabled !== undefined) {
        updateData.notifications_enabled = updates.notificationsEnabled;
      }
      if (updates.emailEnabled !== undefined) {
        updateData.email_enabled = updates.emailEnabled;
      }
      if (updates.smsEnabled !== undefined) {
        updateData.sms_enabled = updates.smsEnabled;
      }
      if (updates.pushEnabled !== undefined) {
        updateData.push_enabled = updates.pushEnabled;
      }
      if (updates.inAppEnabled !== undefined) {
        updateData.in_app_enabled = updates.inAppEnabled;
      }
      if (updates.emailFrequency) {
        updateData.email_frequency = updates.emailFrequency;
      }
      if (updates.unsubscribedCategories) {
        updateData.unsubscribed_categories = updates.unsubscribedCategories;
      }

      const { error } = await this.supabase.from('notification_preferences').upsert({
        organization_id: organizationId,
        user_id: userId,
        ...updateData,
      });

      if (error) throw error;

      // Invalidate cache
      const cacheKey = `preferences:${organizationId}:${userId}`;
      await this.redis.delete(cacheKey);

      return true;
    } catch (error) {
      console.error('Failed to update preferences', error);
      return false;
    }
  }

  /**
   * Get notification audit logs
   */
  async getAuditLogs(notificationId: string, options?: { limit?: number }): Promise<any[]> {
    try {
      let query = this.supabase
        .from('notification_audit_logs')
        .select('*')
        .eq('notification_id', notificationId)
        .order('timestamp', { ascending: false });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data: logs, error } = await query;

      if (error || !logs) return [];

      return logs;
    } catch (error) {
      console.error('Failed to get audit logs', error);
      return [];
    }
  }

  /**
   * Delete notification (soft delete)
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({ deleted: true })
        .eq('id', notificationId);

      if (error) throw error;

      await this.logAudit(notificationId, 'deleted', {});

      return true;
    } catch (error) {
      console.error('Failed to delete notification', error);
      return false;
    }
  }

  /**
   * Process notification queue
   */
  async processQueue(): Promise<void> {
    try {
      const { data: queueItems, error } = await this.supabase
        .from('notification_queue')
        .select('*')
        .in('status', ['pending', 'processing'])
        .lt('next_retry_at', new Date().toISOString())
        .limit(100);

      if (error || !queueItems) return;

      for (const item of queueItems) {
        await this.processQueueItem(item.id, item.notification_id);
      }
    } catch (error) {
      console.error('Failed to process queue', error);
    }
  }

  /**
   * Private methods
   */

  private async queueNotification(notificationId: string): Promise<void> {
    try {
      await this.supabase.from('notification_queue').insert({
        notification_id: notificationId,
        status: 'pending',
      });
    } catch (error) {
      console.error('Failed to queue notification', error);
    }
  }

  private async processQueueItem(queueId: string, notificationId: string): Promise<void> {
    try {
      const notification = await this.getNotification(notificationId);
      if (!notification) return;

      // Send through each channel
      for (const channel of notification.channels) {
        const success = await this.sendThroughChannel(notificationId, channel);
        if (!success) {
          throw new Error(`Failed to send through ${channel}`);
        }
      }

      // Mark as sent
      await this.supabase
        .from('notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      // Mark queue as completed
      await this.supabase
        .from('notification_queue')
        .update({
          status: 'completed',
          processing_completed_at: new Date().toISOString(),
        })
        .eq('id', queueId);

      await this.logAudit(notificationId, 'sent', {});
    } catch (error) {
      console.error('Failed to process queue item', error);

      // Retry logic
      await this.handleQueueFailure(
        queueId,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  private async sendThroughChannel(notificationId: string, channel: string): Promise<boolean> {
    // Implementation depends on channel provider
    // For now, mock the send
    switch (channel) {
      case 'email':
        return await this.sendEmail(notificationId);
      case 'sms':
        return await this.sendSMS(notificationId);
      case 'push':
        return await this.sendPush(notificationId);
      case 'in_app':
        return true; // In-app is stored, no need to send
      default:
        return false;
    }
  }

  private async sendEmail(notificationId: string): Promise<boolean> {
    // Integration with email service (SendGrid, AWS SES, etc.)
    // Placeholder implementation
    console.log(`Sending email for notification ${notificationId}`);
    return true;
  }

  private async sendSMS(notificationId: string): Promise<boolean> {
    // Integration with SMS service (Twilio, etc.)
    // Placeholder implementation
    console.log(`Sending SMS for notification ${notificationId}`);
    return true;
  }

  private async sendPush(notificationId: string): Promise<boolean> {
    // Integration with push service (Firebase Cloud Messaging, etc.)
    // Placeholder implementation
    console.log(`Sending push for notification ${notificationId}`);
    return true;
  }

  private async handleQueueFailure(queueId: string, errorMessage: string): Promise<void> {
    try {
      const { data: item } = await this.supabase
        .from('notification_queue')
        .select('attempts')
        .eq('id', queueId)
        .single();

      const attempts = (item?.attempts || 0) + 1;
      const maxAttempts = 3;

      if (attempts >= maxAttempts) {
        // Move to dead letter
        await this.supabase
          .from('notification_queue')
          .update({
            status: 'dead_letter',
            error_message: errorMessage,
          })
          .eq('id', queueId);
      } else {
        // Retry later
        const nextRetry = new Date();
        nextRetry.setSeconds(nextRetry.getSeconds() + Math.pow(2, attempts) * 60); // Exponential backoff

        await this.supabase
          .from('notification_queue')
          .update({
            attempts,
            next_retry_at: nextRetry.toISOString(),
            error_message: errorMessage,
          })
          .eq('id', queueId);
      }
    } catch (error) {
      console.error('Failed to handle queue failure', error);
    }
  }

  private async logAudit(
    notificationId: string,
    action: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      await this.supabase.from('notification_audit_logs').insert({
        notification_id: notificationId,
        action,
        details,
        actor: 'system',
      });
    } catch (error) {
      console.error('Failed to log audit', error);
    }
  }

  private async invalidateUnreadCountCache(organizationId: string, userId: string): Promise<void> {
    const cacheKey = `${this.UNREAD_COUNT_CACHE}${organizationId}:${userId}`;
    await this.redis.delete(cacheKey);
  }

  private renderTemplate(template: string, variables: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return result;
  }

  private transformNotification(data: any): Notification {
    return {
      id: data.id,
      organizationId: data.organization_id,
      recipientId: data.recipient_id,
      templateId: data.template_id,
      title: data.title,
      subject: data.subject,
      body: data.body,
      actionUrl: data.action_url,
      channels: data.channels || [],
      status: data.status,
      read: data.read,
      category: data.category,
      priority: data.priority,
      scheduledFor: data.scheduled_for ? new Date(data.scheduled_for) : undefined,
      sentAt: data.sent_at ? new Date(data.sent_at) : undefined,
      readAt: data.read_at ? new Date(data.read_at) : undefined,
    };
  }

  private transformTemplate(data: any): NotificationTemplate {
    return {
      id: data.id,
      organizationId: data.organization_id,
      key: data.key,
      name: data.name,
      channels: data.channels || [],
      emailSubject: data.email_subject,
      emailTemplate: data.email_template,
      smsTemplate: data.sms_template,
      whatsappTemplate: data.whatsapp_template,
      pushTitle: data.push_title,
      pushBody: data.push_body,
      inAppTitle: data.in_app_title,
      inAppBody: data.in_app_body,
      category: data.category,
      priority: data.priority,
    };
  }

  private transformPreferences(data: any): NotificationPreferences {
    return {
      userId: data.user_id,
      notificationsEnabled: data.notifications_enabled ?? true,
      emailEnabled: data.email_enabled ?? true,
      smsEnabled: data.sms_enabled ?? true,
      whatsappEnabled: data.whatsapp_enabled ?? true,
      pushEnabled: data.push_enabled ?? true,
      inAppEnabled: data.in_app_enabled ?? true,
      quietHoursEnabled: data.quiet_hours_enabled ?? false,
      emailFrequency: data.email_frequency || 'instant',
      unsubscribedCategories: data.unsubscribed_categories || [],
    };
  }
}
