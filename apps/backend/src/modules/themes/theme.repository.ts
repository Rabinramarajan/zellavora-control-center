import { Prisma } from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { ThemeListQueryDto } from './theme.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ThemeRepository extends BaseRepository {
  transaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return this.withTransaction(fn);
  }

  async findById(organizationId: string, id: string, tx?: TxClient) {
    // uuid columns reject malformed ids with a 500; treat them as missing.
    if (!UUID.test(id)) return null;
    return this.getDb(tx).theme.findFirst({ where: { id, organizationId, isDeleted: false } });
  }

  async findActive(organizationId: string, tx?: TxClient) {
    return this.getDb(tx).theme.findFirst({
      where: { organizationId, isDeleted: false, isDefault: true },
    });
  }

  async findByName(organizationId: string, name: string, tx?: TxClient) {
    return this.getDb(tx).theme.findFirst({
      where: { organizationId, isDeleted: false, name: { equals: name, mode: 'insensitive' } },
    });
  }

  async list(organizationId: string, query: ThemeListQueryDto, tx?: TxClient) {
    const where: Prisma.ThemeWhereInput = { organizationId, isDeleted: false };
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.mode) where.mode = query.mode;
    const [data, total] = await Promise.all([
      this.getDb(tx).theme.findMany({
        where,
        // The active theme always leads the list.
        orderBy: [{ isDefault: 'desc' }, { [query.sort]: query.order }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.getDb(tx).theme.count({ where }),
    ]);
    return { data, total };
  }

  async create(data: Prisma.ThemeUncheckedCreateInput, tx?: TxClient) {
    return this.getDb(tx).theme.create({ data });
  }

  /** Optimistic update: resolves 0 when another save changed the row first. */
  async updateVersioned(
    id: string,
    version: number | undefined,
    data: Prisma.ThemeUncheckedUpdateInput,
    tx?: TxClient
  ) {
    const res = await this.getDb(tx).theme.updateMany({
      where: { id, isDeleted: false, ...(version ? { version } : {}) },
      data: { ...data, version: { increment: 1 } },
    });
    return res.count;
  }

  async clearActive(organizationId: string, tx: TxClient) {
    await tx.theme.updateMany({
      where: { organizationId, isDefault: true },
      data: { isDefault: false },
    });
  }

  async softDelete(id: string, actorId: string, tx?: TxClient) {
    return this.getDb(tx).theme.update({
      where: { id },
      data: {
        isDeleted: true,
        isDefault: false,
        deletedAt: new Date(),
        updatedBy: actorId,
        // (organization_id, name) is unique; release the name for reuse.
        name: `${id}~deleted`,
      },
    });
  }
}
