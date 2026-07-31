import { BaseRepository, TxClient } from '../../infrastructure/prisma';

export class NotificationRepository extends BaseRepository {
  async findById(id: string, tx?: TxClient) {
    return this.getDb(tx).notification.findUnique({
      where: { id },
    });
  }

  async listByOrganization(organizationId: string, tx?: TxClient) {
    return this.getDb(tx).notification.findMany({
      where: { organizationId },
    });
  }

  async create(
    data: {
      organizationId: string;
      recipientId?: string | null;
      title?: string | null;
      body: string;
      channels?: any;
      status?: string;
    },
    tx?: TxClient
  ) {
    return this.getDb(tx).notification.create({
      data,
    });
  }

  async updateStatus(id: string, status: string, tx?: TxClient) {
    return this.getDb(tx).notification.update({
      where: { id },
      data: { status },
    });
  }
}
