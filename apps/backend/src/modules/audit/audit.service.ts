import { AuditRepository } from './audit.repository';
import { paginate } from '../../infrastructure/pagination';

export class AuditService {
  private readonly repo = new AuditRepository();

  async logActivity(data: {
    actorId?: string | null;
    action: string;
    organizationId: string;
    severity?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    return this.repo.createLog(data);
  }

  async getLogs(orgId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const { data, total } = await this.repo.listByOrganization(orgId, limit, offset);
    return paginate(data, total, page, limit);
  }
}
