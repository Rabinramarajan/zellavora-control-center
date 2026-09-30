import { Prisma } from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { TeamListQuery } from './teams.dto';

const memberSelect = {
  id: true,
  fullName: true,
  email: true,
  jobTitle: true,
  avatarUrl: true,
  status: true,
} satisfies Prisma.UserSelect;

export class TeamsRepository extends BaseRepository {
  transaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return this.withTransaction(fn);
  }

  async list(organizationId: string, query: TeamListQuery, tx?: TxClient) {
    const where: Prisma.TeamWhereInput = { organizationId, deletedAt: null };
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.getDb(tx).team.findMany({
        where,
        include: {
          _count: { select: { members: true } },
          members: { select: memberSelect, take: 5, orderBy: { fullName: 'asc' } },
        },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.getDb(tx).team.count({ where }),
    ]);
    return { data, total };
  }

  findById(id: string, organizationId: string, tx?: TxClient) {
    return this.getDb(tx).team.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        _count: { select: { members: true } },
        members: { select: memberSelect, orderBy: { fullName: 'asc' } },
      },
    });
  }

  findByName(organizationId: string, name: string, tx?: TxClient) {
    return this.getDb(tx).team.findFirst({
      where: { organizationId, deletedAt: null, name: { equals: name, mode: 'insensitive' } },
    });
  }

  create(data: Prisma.TeamUncheckedCreateInput, tx?: TxClient) {
    return this.getDb(tx).team.create({ data });
  }

  update(id: string, data: Prisma.TeamUncheckedUpdateInput, tx?: TxClient) {
    return this.getDb(tx).team.update({ where: { id }, data });
  }

  softDelete(id: string, actorId: string, tx?: TxClient) {
    return this.getDb(tx).team.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actorId, members: { set: [] }, memberCount: 0 },
    });
  }

  /** Only live members of the organization can join its teams. */
  orgMemberIds(organizationId: string, userIds: string[], tx?: TxClient) {
    return this.getDb(tx).user.findMany({
      where: {
        id: { in: userIds },
        isDeleted: false,
        userTenants: { some: { tenantId: organizationId } },
      },
      select: { id: true },
    });
  }

  async setMembership(
    id: string,
    change: { connect?: string[]; disconnect?: string[] },
    actorId: string,
    tx: TxClient
  ) {
    await tx.team.update({
      where: { id },
      data: {
        updatedBy: actorId,
        members: {
          ...(change.connect && { connect: change.connect.map((userId) => ({ id: userId })) }),
          ...(change.disconnect && {
            disconnect: change.disconnect.map((userId) => ({ id: userId })),
          }),
        },
      },
    });
    const memberCount = await tx.user.count({ where: { teams: { some: { id } } } });
    await tx.team.update({ where: { id }, data: { memberCount } });
  }
}
