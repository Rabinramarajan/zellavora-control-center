import { OrganizationRepository } from './organization.repository';
import { AppError } from '../../middleware/error';

/** Who is calling: the tenant on the verified token and whether they operate the platform. */
export interface OrganizationCaller {
  tenantId: string;
  isPlatformAdmin: boolean;
}

export class OrganizationService {
  private readonly repo = new OrganizationRepository();

  /** A tenant caller only ever sees its own organization; any other id looks like it does not exist. */
  async getOrganization(id: string, caller: OrganizationCaller) {
    if (id !== caller.tenantId && !caller.isPlatformAdmin) {
      throw new AppError('Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
    }
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
    data: { name?: string; logoUrl?: string | null; enforce2fa?: boolean },
    caller: OrganizationCaller
  ) {
    const org = await this.getOrganization(id, caller);
    // Only the platform may relax two-factor enforcement; a tenant admin can only tighten it.
    if (data.enforce2fa === false && org.enforce2fa && !caller.isPlatformAdmin) {
      throw new AppError(
        'Only a platform administrator can disable two-factor enforcement',
        403,
        'FORBIDDEN_PLATFORM'
      );
    }
    return this.repo.update(id, data);
  }
}
