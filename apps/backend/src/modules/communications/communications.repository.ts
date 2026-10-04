import { Prisma } from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { Audience } from './communications.dto';

export interface HistoryFilter {
  action: string;
  subject?: string;
  sentAt?: { gte?: Date; lte?: Date };
  order: 'asc' | 'desc';
}

export class CommunicationsRepository extends BaseRepository {
  /** Resolve an audience to live, active members of the organization. */
  resolveRecipients(organizationId: string, audience: Audience, limit: number, tx?: TxClient) {
    const where: Prisma.UserWhereInput = {
      isDeleted: false,
      status: 'ACTIVE',
      userTenants: { some: { tenantId: organizationId } },
    };
    switch (audience.type) {
      case 'users':
        where.id = { in: audience.ids };
        break;
      case 'group':
        where.userGroups = { some: { groupId: { in: audience.ids } } };
        break;
      case 'team':
        where.teams = { some: { id: { in: audience.ids }, organizationId, deletedAt: null } };
        break;
      case 'department':
        where.userTenants = {
          some: { tenantId: organizationId, departmentId: { in: audience.ids } },
        };
        break;
      case 'all':
        break;
    }
    return this.getDb(tx).user.findMany({
      where,
      select: { id: true, email: true, fullName: true },
      take: limit + 1,
    });
  }

  createNotifications(rows: Prisma.NotificationCreateManyInput[], tx?: TxClient) {
    return this.getDb(tx).notification.createMany({ data: rows });
  }

  async history(
    organizationId: string,
    filter: HistoryFilter,
    page: number,
    pageSize: number,
    tx?: TxClient
  ) {
    const where: Prisma.AuditLogWhereInput = { organizationId, action: filter.action };
    if (filter.subject) {
      // Emails record a subject, in-app messages a title.
      where.OR = ['subject', 'title'].map((key) => ({
        metadata: { path: [key], string_contains: filter.subject },
      }));
    }
    if (filter.sentAt) where.createdAt = filter.sentAt;
    const [data, total] = await Promise.all([
      this.getDb(tx).auditLog.findMany({
        where,
        include: { actor: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: filter.order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.getDb(tx).auditLog.count({ where }),
    ]);
    return { data, total };
  }
}
