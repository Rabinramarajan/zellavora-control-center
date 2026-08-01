import { BaseRepository, TxClient } from '../../infrastructure/prisma';

export class PermissionRepository extends BaseRepository {
  async findById(id: string, tx?: TxClient) {
    return this.getDb(tx).permission.findUnique({
      where: { id },
    });
  }

  async listAll(tx?: TxClient) {
    return this.getDb(tx).permission.findMany();
  }

  async create(
    data: {
      name: string;
      key?: string;
      resource?: string | null;
      action?: string | null;
      description?: string | null;
      groupId?: string | null;
    },
    tx?: TxClient
  ) {
    const key = data.key ?? data.name.toLowerCase().replace(/[^a-z0-9]+/g, ':');
    return this.getDb(tx).permission.create({
      data: { ...data, key },
    });
  }

  async assignToRole(
    roleId: string,
    permissionId: string,
    effect: 'allow' | 'deny',
    organizationId: string,
    tx?: TxClient
  ) {
    return this.getDb(tx).rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId, permissionId },
      },
      update: { effect },
      create: { organizationId, roleId, permissionId, effect },
    });
  }

  async revokeFromRole(roleId: string, permissionId: string, tx?: TxClient) {
    return this.getDb(tx).rolePermission.delete({
      where: {
        roleId_permissionId: { roleId, permissionId },
      },
    });
  }
}
