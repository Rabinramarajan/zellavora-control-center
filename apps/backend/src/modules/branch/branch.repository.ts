import { Prisma } from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { BranchListQuery } from './branch.dto';

export const BRANCH_CODE_PREFIX = 'BR-';

export class BranchRepository extends BaseRepository {
  /** User counts per branch; users reference branches by a plain `branch_id` column. */
  async userCounts(branchIds: string[], tx?: TxClient): Promise<Map<string, number>> {
    if (!branchIds.length) return new Map();
    const rows = await this.getDb(tx).user.groupBy({
      by: ['branchId'],
      where: { branchId: { in: branchIds } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.branchId ?? '', r._count._all]));
  }

  async list(organizationId: string, query: BranchListQuery, tx?: TxClient) {
    const where: Prisma.BranchWhereInput = { organizationId, isDeleted: false };
    if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { code: { contains: query.q, mode: 'insensitive' } },
        { city: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.getDb(tx).branch.findMany({
        where,
        orderBy: query.sort
          ? [{ [query.sort]: query.order }, { name: 'asc' }]
          : [{ isHeadOffice: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.getDb(tx).branch.count({ where }),
    ]);
    return { data, total };
  }

  findById(id: string, organizationId: string, tx?: TxClient) {
    return this.getDb(tx).branch.findFirst({
      where: { id, organizationId, isDeleted: false },
    });
  }

  findByName(organizationId: string, name: string, tx?: TxClient) {
    return this.getDb(tx).branch.findFirst({
      where: { organizationId, isDeleted: false, name: { equals: name, mode: 'insensitive' } },
    });
  }

  /** Every generated code ever issued, including deleted branches, so codes are never reused. */
  async generatedCodes(organizationId: string, tx?: TxClient) {
    const rows = await this.getDb(tx).branch.findMany({
      where: { organizationId, code: { startsWith: BRANCH_CODE_PREFIX } },
      select: { code: true },
    });
    return rows.map((r) => r.code ?? '');
  }

  /**
   * Serialises code generation per organization for the lifetime of the transaction,
   * so two concurrent creates can never compute the same next code.
   */
  async lockOrganizationCodes(organizationId: string, tx: TxClient) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`branch-code:${organizationId}`}))`;
  }

  clearHeadOffice(organizationId: string, exceptId: string | null, tx?: TxClient) {
    return this.getDb(tx).branch.updateMany({
      where: {
        organizationId,
        isHeadOffice: true,
        isDeleted: false,
        ...(exceptId && { id: { not: exceptId } }),
      },
      data: { isHeadOffice: false },
    });
  }

  create(data: Prisma.BranchUncheckedCreateInput, tx?: TxClient) {
    return this.getDb(tx).branch.create({ data });
  }

  update(id: string, data: Prisma.BranchUncheckedUpdateInput, tx?: TxClient) {
    return this.getDb(tx).branch.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
  }

  async softDelete(id: string, organizationId: string, actorId: string, tx?: TxClient) {
    const db = this.getDb(tx);
    await db.user.updateMany({ where: { branchId: id }, data: { branchId: null } });
    return db.branch.update({
      where: { id, organizationId },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: actorId, isHeadOffice: false },
    });
  }

  transaction<T>(fn: (tx: TxClient) => Promise<T>) {
    return this.withTransaction(fn);
  }
}
