import { RoleRepository } from './role.repository';
import { AppError } from '../../middleware/error';

export class RoleService {
  private readonly repo = new RoleRepository();

  async getRole(id: string) {
    const role = await this.repo.findById(id);
    if (!role) {
      throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
    }
    return role;
  }

  async getRolesForOrg(orgId: string) {
    return this.repo.listByOrganizationId(orgId);
  }

  async createRole(data: {
    name: string;
    organizationId?: string | null;
    description?: string | null;
  }) {
    return this.repo.create(data);
  }

  async updateRole(id: string, data: { name?: string; description?: string | null }) {
    await this.getRole(id);
    return this.repo.update(id, data);
  }
}
