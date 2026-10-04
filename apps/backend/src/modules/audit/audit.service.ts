import { AuditRepository } from './audit.repository';
import { AuditSanitizer } from './audit.sanitizer';
import {
  AuditDetailDto,
  AuditFilterOptionsDto,
  AuditSearchItemDto,
  AuditSearchQuery,
  CreateAuditRecordInput,
} from './audit.dto';
import { getRequestContext } from '../../infrastructure/request-context';

export class AuditService {
  private readonly repo = new AuditRepository();

  /**
   * Log an audit event with automatic redaction of sensitive parameters.
   */
  async logActivity(data: CreateAuditRecordInput | (Partial<CreateAuditRecordInput> & { action: string; organizationId: string })) {
    const ctx = getRequestContext();

    const sanitizedBefore = data.beforeData ? AuditSanitizer.sanitize(data.beforeData) : undefined;
    const sanitizedAfter = data.afterData ? AuditSanitizer.sanitize(data.afterData) : undefined;
    const sanitizedMeta = data.metadata ? AuditSanitizer.sanitize(data.metadata) : undefined;

    const input: CreateAuditRecordInput = {
      organizationId: data.organizationId,
      actorId: data.actorId ?? ctx.actorId ?? null,
      action: data.action,
      module: data.module ?? 'GENERAL',
      resourceType: data.resourceType ?? null,
      resourceId: data.resourceId ?? null,
      resourceName: data.resourceName ?? null,
      httpMethod: data.httpMethod ?? null,
      endpoint: data.endpoint ?? null,
      status: data.status ?? 'SUCCESS',
      severity: data.severity ?? 'info',
      ipAddress: data.ipAddress ?? ctx.ipAddress ?? null,
      userAgent: data.userAgent ?? ctx.userAgent ?? null,
      correlationId: data.correlationId ?? ctx.requestId ?? null,
      beforeData: sanitizedBefore,
      afterData: sanitizedAfter,
      metadata: sanitizedMeta,
      errorCode: data.errorCode ?? null,
      errorMessage: data.errorMessage ? AuditSanitizer.safeErrorMessage(data.errorMessage).message : null,
    };

    return this.repo.createAuditLog(input);
  }

  /**
   * Search audit records with server-side filtering, sorting, and pagination.
   */
  async searchLogs(
    organizationId: string | undefined,
    query: AuditSearchQuery
  ): Promise<{
    content: AuditSearchItemDto[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
  }> {
    const { records, total } = await this.repo.searchAuditLogs(organizationId, query);

    const content: AuditSearchItemDto[] = records.map((record) => ({
      auditId: record.auditId || `AUD-${record.id.slice(0, 8).toUpperCase()}`,
      timestamp: record.createdAt.toISOString(),
      user: {
        id: record.actor?.id ?? record.actorId,
        username: record.actor?.username ?? null,
        email: record.actor?.email ?? null,
        name: record.actor?.displayName ?? record.actor?.fullName ?? null,
      },
      module: record.module ?? 'SYSTEM',
      action: record.action,
      resourceType: record.resourceType ?? record.resource,
      resourceId: record.resourceId,
      resourceName: record.resourceName,
      status: record.status || 'SUCCESS',
      ipAddress: record.ipAddress,
      correlationId: record.correlationId ?? record.requestId,
    }));

    return {
      content,
      page: query.page,
      size: query.size,
      totalElements: total,
      totalPages: Math.ceil(total / query.size),
    };
  }

  /**
   * Retrieve full audit details with safe before/after difference inspection.
   */
  async getAuditDetail(auditIdOrId: string, organizationId?: string): Promise<AuditDetailDto | null> {
    const record = await this.repo.findByAuditIdOrId(auditIdOrId, organizationId);
    if (!record) return null;

    const before = (record.beforeData as Record<string, unknown> | null) ?? null;
    const after = (record.afterData as Record<string, unknown> | null) ?? null;
    const changes = AuditSanitizer.computeChanges(before, after);

    return {
      auditId: record.auditId || `AUD-${record.id.slice(0, 8).toUpperCase()}`,
      timestamp: record.createdAt.toISOString(),
      module: record.module ?? 'SYSTEM',
      action: record.action,
      status: record.status || 'SUCCESS',
      severity: record.severity || 'info',
      actor: {
        userId: record.actor?.id ?? record.actorId,
        username: record.actor?.username ?? null,
        email: record.actor?.email ?? null,
        name: record.actor?.displayName ?? record.actor?.fullName ?? null,
      },
      resource: {
        type: record.resourceType ?? record.resource,
        id: record.resourceId,
        name: record.resourceName,
      },
      request: {
        method: record.httpMethod,
        endpoint: record.endpoint,
        ipAddress: record.ipAddress,
        userAgent: record.userAgent,
        correlationId: record.correlationId ?? record.requestId,
      },
      changes,
      beforeData: before,
      afterData: after,
      metadata: (record.metadata as Record<string, unknown> | null) ?? null,
      error:
        record.errorCode || record.errorMessage
          ? {
              code: record.errorCode,
              message: record.errorMessage,
            }
          : null,
    };
  }

  /**
   * Get distinct values for search filter dropdowns.
   */
  async getFilterOptions(organizationId?: string): Promise<AuditFilterOptionsDto> {
    const defaults = {
      modules: [
        'AUTHENTICATION',
        'USERS',
        'USER_REQUESTS',
        'GROUPS',
        'ROLES',
        'RESOURCES',
        'CONFIGURATION',
        'OPERATIONS',
        'SYSTEM',
      ],
      actions: [
        'LOGIN',
        'LOGOUT',
        'LOGIN_FAILED',
        'CREATE',
        'UPDATE',
        'DELETE',
        'VIEW',
        'ENABLE',
        'DISABLE',
        'ASSIGN',
        'UNASSIGN',
        'APPROVE',
        'REJECT',
        'EXPORT',
        'PASSWORD_CHANGE',
        'ROLE_CHANGE',
      ],
      resourceTypes: ['USER', 'ROLE', 'GROUP', 'RESOURCE', 'BRANCH', 'ORGANIZATION', 'CONFIGURATION'],
      statuses: ['SUCCESS', 'FAILURE', 'PARTIAL'],
    };

    try {
      const distinct = await this.repo.getDistinctFilterOptions(organizationId);
      return {
        modules: Array.from(new Set([...defaults.modules, ...distinct.modules])),
        actions: Array.from(new Set([...defaults.actions, ...distinct.actions])),
        resourceTypes: Array.from(new Set([...defaults.resourceTypes, ...distinct.resourceTypes])),
        statuses: Array.from(new Set([...defaults.statuses, ...distinct.statuses])),
      };
    } catch {
      return defaults;
    }
  }

  /**
   * Export matching audit records as CSV, enforcing a safe limit of 1000 items.
   */
  async exportCsv(
    organizationId: string | undefined,
    query: Omit<AuditSearchQuery, 'page' | 'size'>,
    maxLimit = 1000
  ): Promise<string> {
    const records = await this.repo.exportAuditLogs(organizationId, query, maxLimit);

    const headers = [
      'Audit ID',
      'Timestamp (UTC)',
      'Actor Email',
      'Actor Name',
      'Module',
      'Action',
      'Resource Type',
      'Resource ID',
      'Status',
      'IP Address',
      'Correlation ID',
    ];

    const escapeCsv = (val: unknown) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = records.map((r) => [
      escapeCsv(r.auditId || r.id),
      escapeCsv(r.createdAt.toISOString()),
      escapeCsv(r.actor?.email ?? ''),
      escapeCsv(r.actor?.displayName ?? r.actor?.fullName ?? 'System'),
      escapeCsv(r.module ?? 'SYSTEM'),
      escapeCsv(r.action),
      escapeCsv(r.resourceType ?? r.resource ?? ''),
      escapeCsv(r.resourceId ?? ''),
      escapeCsv(r.status),
      escapeCsv(r.ipAddress ?? ''),
      escapeCsv(r.correlationId ?? r.requestId ?? ''),
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  }
}
