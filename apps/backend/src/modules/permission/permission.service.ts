import { PermissionRepository } from './permission.repository';
import { AppError } from '../../middleware/error';

export class PermissionService {
  private readonly repo = new PermissionRepository();

  async getPermission(id: string) {
    const perm = await this.repo.findById(id);
    if (!perm) {
      throw new AppError('Permission not found', 404, 'PERMISSION_NOT_FOUND');
    }
    return perm;
  }

  async getAllPermissions() {
    return this.repo.listAll();
  }

  async createPermission(data: { name: string; description?: string | null; groupId?: string | null }) {
    return this.repo.create(data);
  }

  async assignPermissionToRole(roleId: string, permissionId: string, effect: 'allow' | 'deny') {
    return this.repo.assignToRole(roleId, permissionId, effect);
  }

  async revokePermissionFromRole(roleId: string, permissionId: string) {
    return this.repo.revokeFromRole(roleId, permissionId);
  }
}
