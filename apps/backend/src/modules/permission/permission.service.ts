import { PermissionRepository } from './permission.repository';

export class PermissionService {
  private readonly repo = new PermissionRepository();

  async getAllPermissions() {
    return this.repo.listAll();
  }

  async createPermission(data: {
    name: string;
    description?: string | null;
    groupId?: string | null;
  }) {
    return this.repo.create(data);
  }

  async assignPermissionToRole(
    roleId: string,
    permissionId: string,
    effect: 'allow' | 'deny',
    organizationId: string
  ) {
    return this.repo.assignToRole(roleId, permissionId, effect, organizationId);
  }

}
