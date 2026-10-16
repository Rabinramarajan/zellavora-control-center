import { NotificationRepository } from './notification.repository';
import type { ListNotificationsQuery } from './notification.dto';

export class NotificationService {
  private readonly repo = new NotificationRepository();

  async listMine(organizationId: string, userId: string, query: ListNotificationsQuery) {
    const { total, items } = await this.repo.listForRecipient(organizationId, userId, {
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return { items, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  /**
   * Record a notification for a user of `organizationId`. Server-side callers only:
   * no route exposes this, so the organization and recipient are never client input.
   */
  async sendNotification(data: {
    organizationId: string;
    recipientId?: string | null;
    title?: string | null;
    body: string;
    channels?: string[];
  }) {
    return this.repo.create({
      organizationId: data.organizationId,
      recipientId: data.recipientId,
      title: data.title,
      body: data.body,
      channels: data.channels ?? ['in_app'],
      status: 'pending',
    });
  }
}
