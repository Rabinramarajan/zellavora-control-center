import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { Prisma } from '@prisma/client';

export interface DdlUpsertInput {
  type: string;
  key: string;
  value: string;
  label?: string | null;
  phoneCode?: string | null;
  extra?: Prisma.InputJsonValue | null;
  sortOrder?: number;
  isActive?: boolean;
}

export class DdlRepository extends BaseRepository {
  async findByType(type: string, tx?: TxClient) {
    return this.getDb(tx).ddl.findMany({
      where: { type, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
    });
  }

  async listActive(tx?: TxClient) {
    return this.getDb(tx).ddl.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { value: 'asc' }],
    });
  }

  async upsert(input: DdlUpsertInput, tx?: TxClient) {
    const db = this.getDb(tx);
    const existing = await db.ddl.findUnique({
      where: { type_key: { type: input.type, key: input.key } },
    });

    if (existing) {
      return db.ddl.update({
        where: { id: existing.id },
        data: {
          value: input.value,
          label: input.label ?? null,
          phoneCode: input.phoneCode ?? null,
          extra: input.extra ?? undefined,
          sortOrder: input.sortOrder ?? existing.sortOrder,
          isActive: input.isActive ?? existing.isActive,
        },
      });
    }

    return db.ddl.create({
      data: {
        type: input.type,
        key: input.key,
        value: input.value,
        label: input.label,
        phoneCode: input.phoneCode,
        extra: input.extra,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      },
    });
  }
}
