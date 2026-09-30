import type { CommonConfiguration } from '@prisma/client';
import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import { EncryptionService } from '../../services/auth';
import { ConfigurationRepository } from './configuration.repository';
import { ConfigurationListQuery, UpsertConfigurationDto } from './configuration.dto';

const MASK = '••••••••';

/** Secrets are write-only through the API: they are stored encrypted and always returned masked. */
const toView = (row: CommonConfiguration) => ({
  id: row.id,
  key: row.key,
  value: row.isEncrypted ? MASK : row.value,
  category: row.category,
  isEncrypted: row.isEncrypted,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export class ConfigurationService {
  constructor(private readonly repo = new ConfigurationRepository()) {}

  async list(organizationId: string, query: ConfigurationListQuery) {
    const [{ data, total }, categories] = await Promise.all([
      this.repo.list(organizationId, query),
      this.repo.categories(organizationId),
    ]);
    return {
      data: data.map(toView),
      categories: categories.map((c) => c.category).filter((c): c is string => !!c),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async upsert(organizationId: string, dto: UpsertConfigurationDto, actorId: string) {
    const existing = await this.repo.find(organizationId, dto.key);

    let value: string;
    if (dto.value !== undefined) {
      value = dto.isEncrypted ? EncryptionService.encrypt(dto.value) : dto.value;
    } else if (existing && existing.isEncrypted && dto.isEncrypted) {
      value = existing.value;
    } else {
      throw new AppError('Value is required', 400, 'VALIDATION_ERROR', { field: 'value' });
    }

    const saved = await this.repo.upsert(organizationId, dto.key, {
      value,
      category: dto.category ?? null,
      isEncrypted: dto.isEncrypted,
    });
    await AuditService.log({
      organizationId,
      actorId,
      action: existing ? 'configuration.updated' : 'configuration.created',
      resource: 'configuration',
      resourceId: saved.id,
      // Values are left out of the audit trail on purpose; they may be secrets.
      metadata: { key: dto.key, category: dto.category ?? null, isEncrypted: dto.isEncrypted },
    });
    return toView(saved);
  }

  async remove(organizationId: string, key: string, actorId: string) {
    const existing = await this.repo.find(organizationId, key);
    if (!existing) throw new AppError('Configuration not found', 404, 'CONFIGURATION_NOT_FOUND');
    await this.repo.delete(organizationId, key);
    await AuditService.log({
      organizationId,
      actorId,
      action: 'configuration.deleted',
      resource: 'configuration',
      resourceId: existing.id,
      severity: 'warning',
      metadata: { key },
    });
    return { success: true };
  }
}
