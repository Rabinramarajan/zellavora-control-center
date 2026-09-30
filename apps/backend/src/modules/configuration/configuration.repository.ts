import { Prisma } from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { ConfigurationListQuery } from './configuration.dto';

export class ConfigurationRepository extends BaseRepository {
  async list(organizationId: string, query: ConfigurationListQuery, tx?: TxClient) {
    const where: Prisma.CommonConfigurationWhereInput = { organizationId };
    if (query.category) where.category = query.category;
    if (query.q) {
      where.OR = [
        { key: { contains: query.q, mode: 'insensitive' } },
        { category: { contains: query.q, mode: 'insensitive' } },
        // Never match against secret values.
        { isEncrypted: false, value: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.getDb(tx).commonConfiguration.findMany({
        where,
        orderBy: [{ category: 'asc' }, { key: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.getDb(tx).commonConfiguration.count({ where }),
    ]);
    return { data, total };
  }

  categories(organizationId: string, tx?: TxClient) {
    return this.getDb(tx).commonConfiguration.findMany({
      where: { organizationId, category: { not: null } },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
  }

  find(organizationId: string, key: string, tx?: TxClient) {
    return this.getDb(tx).commonConfiguration.findUnique({
      where: { organizationId_key: { organizationId, key } },
    });
  }

  upsert(
    organizationId: string,
    key: string,
    data: { value: string; category: string | null; isEncrypted: boolean },
    tx?: TxClient
  ) {
    return this.getDb(tx).commonConfiguration.upsert({
      where: { organizationId_key: { organizationId, key } },
      update: data,
      create: { organizationId, key, ...data },
    });
  }

  delete(organizationId: string, key: string, tx?: TxClient) {
    return this.getDb(tx).commonConfiguration.delete({
      where: { organizationId_key: { organizationId, key } },
    });
  }
}
