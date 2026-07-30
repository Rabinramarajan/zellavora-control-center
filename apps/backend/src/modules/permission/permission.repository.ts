import { BaseRepository, TxClient } from '../../infrastructure/prisma';

export class PermissionRepository extends BaseRepository {
  async findById(id: string, tx?: TxClient) {
    return this.getDb(tx).permission.findUnique({
      where: { id }
    });
  }

  async listAll(tx?: TxClient) {
    return this.getDb(tx).permission.findMany();
  }

  async create(data: { name: string; description?: string | null; groupId?: string | null }, tx?: TxClient) {
    return this.getDb(tx).permission.create({
      data
    });
  }

  async assignToRole(roleId: string, permissionId: string, effect: 'allow' | 'deny', tx?: TxClient) {
    return this.getDb(tx).rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId, permissionId }
      },
      update: { effect },
      create: { roleId, permissionId, effect }
    });
  }

  async revokeFromRole(roleId: string, permissionId: string, tx?: TxClient) {
    return this.getDb(tx).rolePermission.delete({
      where: {
        roleId_permissionId: { roleId, permissionId }
      }
    });
  }
}
