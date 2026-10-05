import { PermissionRepository } from './permission.repository';
import { MenuService } from '../../services/auth/menu.service';

export class PermissionService {
  private readonly repo = new PermissionRepository();

  async getAllPermissions() {
    // Menu entries are grantable from the Roles screen only once they exist here.
    await MenuService.ensureNavigationPermissions();
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
