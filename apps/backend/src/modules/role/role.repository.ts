import { BaseRepository, TxClient } from '../../infrastructure/prisma';

export class RoleRepository extends BaseRepository {
  async findById(id: string, tx?: TxClient) {
    return this.getDb(tx).role.findUnique({
      where: { id }
    });
  }

  async listByOrganizationId(organizationId: string, tx?: TxClient) {
    return this.getDb(tx).role.findMany({
      where: { organizationId }
    });
  }

  async create(data: { name: string; organizationId?: string | null; description?: string | null }, tx?: TxClient) {
    return this.getDb(tx).role.create({
      data
    });
  }

  async update(id: string, data: { name?: string; description?: string | null }, tx?: TxClient) {
    return this.getDb(tx).role.update({
      where: { id },
      data
    });
  }

  async delete(id: string, tx?: TxClient) {
    return this.getDb(tx).role.delete({
      where: { id }
    });
  }
}
