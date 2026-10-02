import { Prisma } from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { SessionListQuery } from './sessions.dto';

/**
 * Every query takes `organizationId`; `null` means "all organizations" and is only
 * passed for the platform super admin.
 */
type OrgFilter = string | null;

const orgWhere = (organizationId: OrgFilter): Prisma.SessionWhereInput =>
  organizationId ? { organizationId } : {};

export class SessionsRepository extends BaseRepository {
  private liveWhere(organizationId: OrgFilter): Prisma.SessionWhereInput {
    return { ...orgWhere(organizationId), isActive: true, expiresAt: { gt: new Date() } };
  }

  /** Users matching a free-text query, used to filter sessions (sessions have no user relation). */
  findUserIds(organizationId: OrgFilter, q: string, tx?: TxClient) {
    return this.getDb(tx).user.findMany({
      where: {
        ...(organizationId && { userTenants: { some: { tenantId: organizationId } } }),
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      take: 500,
    });
  }

  async list(
    organizationId: OrgFilter,
    query: SessionListQuery,
    userIds?: string[],
    tx?: TxClient
  ) {
    const where: Prisma.SessionWhereInput =
      query.status === 'all' ? orgWhere(organizationId) : this.liveWhere(organizationId);
    if (query.userId) where.userId = query.userId;
    if (userIds) where.userId = { in: userIds };

    const [data, total] = await Promise.all([
      this.getDb(tx).session.findMany({
        where,
        orderBy: { lastActivityAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.getDb(tx).session.count({ where }),
    ]);
    return { data, total };
  }

  findUsers(ids: string[], tx?: TxClient) {
    return this.getDb(tx).user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true, email: true, avatarUrl: true },
    });
  }

  findOrganizations(ids: string[], tx?: TxClient) {
    return this.getDb(tx).organization.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
  }

  async stats(organizationId: OrgFilter, userIds?: string[], tx?: TxClient) {
    const where: Prisma.SessionWhereInput = {
      ...this.liveWhere(organizationId),
      ...(userIds && { userId: { in: userIds } }),
    };
    const [active, users] = await Promise.all([
      this.getDb(tx).session.count({ where }),
      this.getDb(tx).session.groupBy({ by: ['userId'], where }),
    ]);
    return { activeSessions: active, activeUsers: users.length };
  }

  findLive(id: string, organizationId: OrgFilter, tx?: TxClient) {
    return this.getDb(tx).session.findFirst({ where: { id, ...this.liveWhere(organizationId) } });
  }

  revoke(id: string, tx?: TxClient) {
    return this.getDb(tx).session.update({ where: { id }, data: { isActive: false } });
  }

  revokeAllForUser(organizationId: OrgFilter, userId: string, exceptId?: string, tx?: TxClient) {
    return this.getDb(tx).session.updateMany({
      where: {
        ...orgWhere(organizationId),
        userId,
        isActive: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isActive: false },
    });
  }

  /** Whether the user is a platform-level super admin (oversees every organization). */
  async isPlatformAdmin(userId: string, tx?: TxClient): Promise<boolean> {
    const user = await this.getDb(tx).user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true, isDeleted: true },
    });
    return !!user && user.isPlatformAdmin && !user.isDeleted;
  }

  /** Users of the organization whose reporting manager is one of `managerIds`. */
  directReports(organizationId: string, managerIds: string[], tx?: TxClient) {
    return this.getDb(tx).user.findMany({
      where: {
        reportingManagerId: { in: managerIds },
        userTenants: { some: { tenantId: organizationId } },
      },
      select: { id: true },
    });
  }

  /** Everyone who shares a live team with `userId` in the organization. */
  teammates(organizationId: string, userId: string, tx?: TxClient) {
    return this.getDb(tx).user.findMany({
      where: {
        teams: {
          some: { organizationId, deletedAt: null, members: { some: { id: userId } } },
        },
      },
      select: { id: true },
    });
  }
}
