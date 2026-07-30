import { BaseRepository, TxClient } from '../../infrastructure/prisma';

export class SettingsRepository extends BaseRepository {
  async findByKey(organizationId: string, key: string, tx?: TxClient) {
    return this.getDb(tx).commonConfiguration.findUnique({
      where: {
        organizationId_key: { organizationId, key }
      }
    });
  }

  async listByOrganization(organizationId: string, tx?: TxClient) {
    return this.getDb(tx).commonConfiguration.findMany({
      where: { organizationId }
    });
  }

  async set(organizationId: string, key: string, value: string, category?: string | null, tx?: TxClient) {
    return this.getDb(tx).commonConfiguration.upsert({
      where: {
        organizationId_key: { organizationId, key }
      },
      update: { value, category },
      create: { organizationId, key, value, category }
    });
  }

  async delete(organizationId: string, key: string, tx?: TxClient) {
    return this.getDb(tx).commonConfiguration.delete({
      where: {
        organizationId_key: { organizationId, key }
      }
    });
  }
}
