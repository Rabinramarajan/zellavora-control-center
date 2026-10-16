import { BaseRepository, TxClient } from '../../infrastructure/prisma';

export class NotificationRepository extends BaseRepository {
  /** One member's notifications, newest first. Both ids come from the verified token. */
  async listForRecipient(
    organizationId: string,
    recipientId: string,
    page: { skip: number; take: number },
    tx?: TxClient
  ) {
    const where = { organizationId, recipientId };
    const db = this.getDb(tx);
    const [total, items] = await Promise.all([
      db.notification.count({ where }),
      db.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: page.skip,
        take: page.take,
      }),
    ]);
    return { total, items };
  }

  async create(
    data: {
      organizationId: string;
      recipientId?: string | null;
      title?: string | null;
      body: string;
      channels?: string[];
      status?: string;
    },
    tx?: TxClient
  ) {
    return this.getDb(tx).notification.create({ data });
  }
}
