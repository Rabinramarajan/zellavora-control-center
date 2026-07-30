import { BranchRepository } from './branch.repository';
import { AppError } from '../../middleware/error';

export class BranchService {
  private readonly repo = new BranchRepository();

  async getBranch(id: string) {
    const branch = await this.repo.findById(id);
    if (!branch) {
      throw new AppError('Branch not found', 404, 'BRANCH_NOT_FOUND');
    }
    return branch;
  }

  async getBranchesForOrg(orgId: string) {
    return this.repo.listByOrganizationId(orgId);
  }

  async createBranch(data: { organizationId: string; name: string; code?: string | null }) {
    return this.repo.create(data);
  }

  async updateBranch(id: string, data: { name?: string; code?: string | null }) {
    await this.getBranch(id);
    return this.repo.update(id, data);
  }
}
