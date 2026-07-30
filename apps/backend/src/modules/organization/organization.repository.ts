import { BaseRepository, TxClient } from '../../infrastructure/prisma';

export class OrganizationRepository extends BaseRepository {
  async findById(id: string, tx?: TxClient) {
    return this.getDb(tx).tenant.findUnique({
      where: { id }
    });
  }

  async findByClientCode(clientCode: string, tx?: TxClient) {
    return this.getDb(tx).tenant.findUnique({
      where: { clientCode }
    });
  }

  async create(data: { name: string; clientCode: string; logoUrl?: string | null }, tx?: TxClient) {
    return this.getDb(tx).tenant.create({
      data: {
        name: data.name,
        clientCode: data.clientCode,
        logoUrl: data.logoUrl,
        plan: 'enterprise',
        enforce2fa: true,
      }
    });
  }

  async update(id: string, data: { name?: string; logoUrl?: string | null; plan?: string; enforce2fa?: boolean }, tx?: TxClient) {
    return this.getDb(tx).tenant.update({
      where: { id },
      data
    });
  }

  async delete(id: string, tx?: TxClient) {
    return this.getDb(tx).tenant.delete({
      where: { id }
    });
  }
}
