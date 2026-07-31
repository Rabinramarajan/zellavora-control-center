import { OrganizationRepository } from './organization.repository';
import { AppError } from '../../middleware/error';

export class OrganizationService {
  private readonly repo = new OrganizationRepository();

  async getOrganization(id: string) {
    const org = await this.repo.findById(id);
    if (!org) {
      throw new AppError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
    }
    return org;
  }

  async createOrganization(data: { name: string; clientCode: string; logoUrl?: string | null }) {
    const existing = await this.repo.findByClientCode(data.clientCode);
    if (existing) {
      throw new AppError('Workspace slug already taken', 400, 'SLUG_TAKEN');
    }
    return this.repo.create(data);
  }

  async updateOrganization(
    id: string,
    data: { name?: string; logoUrl?: string | null; enforce2fa?: boolean }
  ) {
    await this.getOrganization(id);
    return this.repo.update(id, data);
  }
}
