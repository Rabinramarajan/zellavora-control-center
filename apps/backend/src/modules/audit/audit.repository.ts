import { BaseRepository, TxClient } from '../../infrastructure/prisma';

export class AuditRepository extends BaseRepository {
  async createLog(
    data: {
      actorId?: string | null;
      action: string;
      organizationId: string;
      severity?: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
    tx?: TxClient
  ) {
    return this.getDb(tx).auditLog.create({
      data,
    });
  }

  async listByOrganization(organizationId: string, limit = 20, offset = 0, tx?: TxClient) {
    const [data, total] = await Promise.all([
      this.getDb(tx).auditLog.findMany({
        where: { organizationId },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.getDb(tx).auditLog.count({
        where: { organizationId },
      }),
    ]);
    return { data, total };
  }
}
