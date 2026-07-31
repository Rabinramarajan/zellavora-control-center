import { BaseRepository, TxClient } from '../../infrastructure/prisma';

export class BranchRepository extends BaseRepository {
  async findById(id: string, tx?: TxClient) {
    return this.getDb(tx).branch.findUnique({
      where: { id },
    });
  }

  async listByOrganizationId(organizationId: string, tx?: TxClient) {
    return this.getDb(tx).branch.findMany({
      where: { organizationId },
    });
  }

  async create(
    data: { organizationId: string; name: string; code?: string | null },
    tx?: TxClient
  ) {
    return this.getDb(tx).branch.create({
      data,
    });
  }

  async update(id: string, data: { name?: string; code?: string | null }, tx?: TxClient) {
    return this.getDb(tx).branch.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, tx?: TxClient) {
    return this.getDb(tx).branch.delete({
      where: { id },
    });
  }
}
