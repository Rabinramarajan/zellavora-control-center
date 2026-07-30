import { NotificationRepository } from './notification.repository';
import { addQueueJob } from '../../infrastructure/queue';

export class NotificationService {
  private readonly repo = new NotificationRepository();

  async getNotifications(orgId: string) {
    return this.repo.listByOrganization(orgId);
  }

  async sendNotification(data: { organizationId: string; recipientId?: string | null; title?: string | null; body: string; channels?: string[] }) {
    const notification = await this.repo.create({
      organizationId: data.organizationId,
      recipientId: data.recipientId,
      title: data.title,
      body: data.body,
      channels: data.channels || ['email'],
      status: 'pending'
    });

    if (data.channels?.includes('email')) {
      // Trigger background email task using BullMQ queue
      await addQueueJob('send-otp', {
        email: 'admin@zellavora.com', // Real impl maps to recipient email
        otp: data.body
      });
      await this.repo.updateStatus(notification.id, 'sent');
    }

    return notification;
  }
}
