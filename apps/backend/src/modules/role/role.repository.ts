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

  async create(data: { name: string; organizationId?: string | null; description?: string | null; key?: string }, tx?: TxClient) {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const key = data.key ?? (data.organizationId ? `${data.organizationId}_${slug}` : slug);
    return this.getDb(tx).role.create({
      data: { ...data, key }
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
