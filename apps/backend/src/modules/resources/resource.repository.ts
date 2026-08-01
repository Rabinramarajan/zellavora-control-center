import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { Prisma } from '@prisma/client';
import { ResourceListQueryDto } from './resource.dto';

interface ResourceWhere extends Prisma.ResourceWhereInput {}

export class ResourceRepository extends BaseRepository {
  /** Public transaction wrapper so services can orchestrate multi-repo writes. */
  transaction<T>(
    fn: (tx: TxClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeoutMs?: number }
  ): Promise<T> {
    return this.withTransaction(fn, options);
  }

  async findById(id: string, tx?: TxClient) {
    return this.getDb(tx).resource.findUnique({
      where: { id },
      include: { actions: { include: { permission: true } }, children: { select: { id: true, name: true } } },
    });
  }

  async findByKey(key: string, tx?: TxClient) {
    return this.getDb(tx).resource.findUnique({ where: { key } });
  }

  async list(query: ResourceListQueryDto, tx?: TxClient) {
    const where: ResourceWhere = { isDeleted: false };

    if (query.q) {
      const term = `%${query.q}%`;
      where.OR = [{ name: { contains: query.q, mode: 'insensitive' } }, { key: { contains: query.q, mode: 'insensitive' } }, { description: { contains: query.q, mode: 'insensitive' } }];
      void term;
    }
    if (query.type?.length) where.type = { in: query.type };
    if (query.category) where.category = query.category;
    if (query.status?.length) where.status = { in: query.status };
    if (query.parentId) where.parentId = query.parentId;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.isSystem) where.isSystem = query.isSystem === 'true';

    const [data, total] = await Promise.all([
      this.getDb(tx).resource.findMany({
        where,
        include: {
          actions: true,
          _count: { select: { children: true } },
        },
        orderBy: { [query.sort]: query.order },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.getDb(tx).resource.count({ where }),
    ]);

    return { data, total };
  }

  async listTree(tx?: TxClient) {
    return this.getDb(tx).resource.findMany({
      where: { isDeleted: false },
      include: { actions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(
    data: {
      name: string;
      key: string;
      type: string;
      category?: string | null;
      description?: string | null;
      parentId?: string | null;
      ownerId?: string | null;
      metadata?: Record<string, unknown> | null;
      createdBy?: string | null;
    },
    tx?: TxClient
  ) {
    return this.getDb(tx).resource.create({
      data: {
        name: data.name,
        key: data.key,
        type: data.type as never,
        category: data.category ?? null,
        description: data.description ?? null,
        parentId: data.parentId ?? null,
        ownerId: data.ownerId ?? null,
        metadata: (data.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        createdBy: data.createdBy ?? null,
      },
    });
  }

  async update(id: string, data: Record<string, unknown>, tx?: TxClient) {
    return this.getDb(tx).resource.update({ where: { id }, data });
  }

  async softDelete(id: string, deletedBy?: string | null, tx?: TxClient) {
    return this.getDb(tx).resource.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: deletedBy ?? null },
    });
  }

  async countWhere(where: ResourceWhere, tx?: TxClient) {
    return this.getDb(tx).resource.count({ where });
  }
}
