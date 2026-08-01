import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { Prisma } from '@prisma/client';
import { GroupListQueryDto } from './group.dto';

interface GroupWhere extends Prisma.GroupWhereInput {}

export class GroupRepository extends BaseRepository {
  /** Public transaction wrapper so services can orchestrate multi-repo writes. */
  transaction<T>(
    fn: (tx: TxClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeoutMs?: number }
  ): Promise<T> {
    return this.withTransaction(fn, options);
  }

  async findById(id: string, tx?: TxClient) {
    return this.getDb(tx).group.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { children: true, members: true, groupRoles: true } },
      },
    });
  }

  async findByIdDetail(id: string, tx?: TxClient) {
    return this.getDb(tx).group.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, type: true } },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
                status: true,
                avatarUrl: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        groupRoles: { include: { role: true }, orderBy: { createdAt: 'asc' } },
        _count: { select: { children: true, members: true, groupRoles: true } },
      },
    });
  }

  async findByName(name: string, tx?: TxClient) {
    return this.getDb(tx).group.findUnique({ where: { name } });
  }

  async list(query: GroupListQueryDto, tx?: TxClient) {
    const where: GroupWhere = { isDeleted: false };

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { slug: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.type?.length) where.type = { in: query.type };
    if (query.status?.length) where.status = { in: query.status };
    if (query.parentId) where.parentId = query.parentId;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.isSystem) where.isSystem = query.isSystem === 'true';

    const [data, total] = await Promise.all([
      this.getDb(tx).group.findMany({
        where,
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { children: true, members: true, groupRoles: true } },
        },
        orderBy: { [query.sort]: query.order },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.getDb(tx).group.count({ where }),
    ]);

    return { data, total };
  }

  async listTree(tx?: TxClient) {
    return this.getDb(tx).group.findMany({
      where: { isDeleted: false },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { children: true, members: true, groupRoles: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(
    data: {
      name: string;
      slug: string;
      type: string;
      status: string;
      description?: string | null;
      parentId?: string | null;
      ownerId?: string | null;
      isSystem?: boolean;
      createdBy?: string | null;
    },
    tx?: TxClient
  ) {
    return this.getDb(tx).group.create({
      data: {
        name: data.name,
        slug: data.slug,
        type: data.type as never,
        status: data.status as never,
        description: data.description ?? null,
        parentId: data.parentId ?? null,
        ownerId: data.ownerId ?? null,
        isSystem: data.isSystem ?? false,
        createdBy: data.createdBy ?? null,
      },
    });
  }

  async update(id: string, data: Record<string, unknown>, tx?: TxClient) {
    return this.getDb(tx).group.update({ where: { id }, data });
  }

  async softDelete(id: string, deletedBy?: string | null, tx?: TxClient) {
    return this.getDb(tx).group.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: deletedBy ?? null },
    });
  }

  async addMembers(groupId: string, userIds: string[], tx: TxClient) {
    await tx.userGroup.createMany({
      data: userIds.map((userId) => ({ groupId, userId })),
      skipDuplicates: true,
    });
  }

  async removeMember(groupId: string, userId: string, tx: TxClient) {
    await tx.userGroup.deleteMany({ where: { groupId, userId } });
  }

  async replaceRoles(groupId: string, roleIds: string[], tx: TxClient) {
    await tx.groupRole.deleteMany({ where: { groupId } });
    if (roleIds.length > 0) {
      await tx.groupRole.createMany({
        data: roleIds.map((roleId) => ({ groupId, roleId })),
        skipDuplicates: true,
      });
    }
  }

  async mergeRoles(groupId: string, roleIds: string[], tx: TxClient) {
    for (const roleId of roleIds) {
      await tx.groupRole.upsert({
        where: { groupId_roleId: { groupId, roleId } },
        update: {},
        create: { groupId, roleId },
      });
    }
  }

  async countWhere(where: GroupWhere, tx?: TxClient) {
    return this.getDb(tx).group.count({ where });
  }
}
