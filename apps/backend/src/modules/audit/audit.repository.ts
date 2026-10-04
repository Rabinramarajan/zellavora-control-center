import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { Prisma } from '@prisma/client';
import { AuditSearchQuery, CreateAuditRecordInput } from './audit.dto';

const ALLOWED_SORT_FIELDS: Record<string, string> = {
  timestamp: 'createdAt',
  createdat: 'createdAt',
  action: 'action',
  module: 'module',
  status: 'status',
  user: 'actorId',
  resourcetype: 'resourceType',
};

export class AuditRepository extends BaseRepository {
  async createAuditLog(data: CreateAuditRecordInput, tx?: TxClient) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const auditId = `AUD-${today}-${randomHex}`;

    return this.getDb(tx).auditLog.create({
      data: {
        auditId,
        organizationId: data.organizationId,
        actorId: data.actorId ?? null,
        action: data.action,
        module: data.module ?? null,
        resource: data.resourceType ?? null,
        resourceType: data.resourceType ?? null,
        resourceId: data.resourceId ?? null,
        resourceName: data.resourceName ?? null,
        httpMethod: data.httpMethod ?? null,
        endpoint: data.endpoint ?? null,
        status: data.status,
        severity: data.severity,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        correlationId: data.correlationId ?? null,
        requestId: data.correlationId ?? null,
        beforeData: (data.beforeData as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        afterData: (data.afterData as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        errorCode: data.errorCode ?? null,
        errorMessage: data.errorMessage ?? null,
      },
    });
  }

  async findByAuditIdOrId(idOrAuditId: string, organizationId?: string) {
    const where: Prisma.AuditLogWhereInput = {
      OR: [{ id: idOrAuditId.length === 36 ? idOrAuditId : undefined }, { auditId: idOrAuditId }].filter(
        Boolean
      ) as Prisma.AuditLogWhereInput[],
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    return this.getDb().auditLog.findFirst({
      where,
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            displayName: true,
          },
        },
      },
    });
  }

  async searchAuditLogs(organizationId: string | undefined, query: AuditSearchQuery) {
    const where = this.buildWhereClause(organizationId, query);
    const { orderBy } = this.buildSort(query.sort);
    const skip = (query.page - 1) * query.size;
    const take = query.size;

    const [records, total] = await Promise.all([
      this.getDb().auditLog.findMany({
        where,
        take,
        skip,
        orderBy,
        include: {
          actor: {
            select: {
              id: true,
              username: true,
              email: true,
              fullName: true,
              displayName: true,
            },
          },
        },
      }),
      this.getDb().auditLog.count({ where }),
    ]);

    return { records, total };
  }

  async getDistinctFilterOptions(organizationId?: string) {
    const where = organizationId ? { organizationId } : {};

    const [modules, actions, resourceTypes, statuses] = await Promise.all([
      this.getDb().auditLog.findMany({
        where: { ...where, module: { not: null } },
        select: { module: true },
        distinct: ['module'],
      }),
      this.getDb().auditLog.findMany({
        where,
        select: { action: true },
        distinct: ['action'],
      }),
      this.getDb().auditLog.findMany({
        where: { ...where, resourceType: { not: null } },
        select: { resourceType: true },
        distinct: ['resourceType'],
      }),
      this.getDb().auditLog.findMany({
        where,
        select: { status: true },
        distinct: ['status'],
      }),
    ]);

    return {
      modules: Array.from(new Set(modules.map((m) => m.module).filter(Boolean))) as string[],
      actions: Array.from(new Set(actions.map((a) => a.action).filter(Boolean))) as string[],
      resourceTypes: Array.from(new Set(resourceTypes.map((r) => r.resourceType).filter(Boolean))) as string[],
      statuses: Array.from(new Set(statuses.map((s) => s.status).filter(Boolean))) as string[],
    };
  }

  async exportAuditLogs(organizationId: string | undefined, query: Omit<AuditSearchQuery, 'page' | 'size'>, maxLimit = 1000) {
    const where = this.buildWhereClause(organizationId, query);
    const { orderBy } = this.buildSort(query.sort);

    return this.getDb().auditLog.findMany({
      where,
      take: maxLimit,
      orderBy,
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            displayName: true,
          },
        },
      },
    });
  }

  private buildWhereClause(
    organizationId: string | undefined,
    query: Partial<AuditSearchQuery>
  ): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (query.module) {
      where.module = { equals: query.module, mode: 'insensitive' };
    }

    if (query.action) {
      where.action = { equals: query.action, mode: 'insensitive' };
    }

    if (query.status) {
      where.status = { equals: query.status, mode: 'insensitive' };
    }

    if (query.resourceType) {
      where.resourceType = { equals: query.resourceType, mode: 'insensitive' };
    }

    if (query.resourceId) {
      where.resourceId = { contains: query.resourceId, mode: 'insensitive' };
    }

    if (query.ipAddress) {
      where.ipAddress = { contains: query.ipAddress, mode: 'insensitive' };
    }

    if (query.correlationId) {
      where.correlationId = { contains: query.correlationId, mode: 'insensitive' };
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        // If string is YYYY-MM-DD, include the entire day
        if (query.dateTo.length === 10) {
          to.setUTCHours(23, 59, 59, 999);
        }
        where.createdAt.lte = to;
      }
    }

    if (query.user) {
      where.OR = [
        { actorId: query.user.length === 36 ? query.user : undefined },
        { actor: { email: { contains: query.user, mode: 'insensitive' } } },
        { actor: { username: { contains: query.user, mode: 'insensitive' } } },
        { actor: { fullName: { contains: query.user, mode: 'insensitive' } } },
      ].filter(Boolean) as Prisma.AuditLogWhereInput[];
    }

    if (query.searchText) {
      const st = query.searchText.trim();
      const textConditions: Prisma.AuditLogWhereInput[] = [
        { action: { contains: st, mode: 'insensitive' } },
        { module: { contains: st, mode: 'insensitive' } },
        { resourceName: { contains: st, mode: 'insensitive' } },
        { resourceId: { contains: st, mode: 'insensitive' } },
        { correlationId: { contains: st, mode: 'insensitive' } },
        { ipAddress: { contains: st, mode: 'insensitive' } },
        { auditId: { contains: st, mode: 'insensitive' } },
        { actor: { email: { contains: st, mode: 'insensitive' } } },
        { actor: { fullName: { contains: st, mode: 'insensitive' } } },
      ];

      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: textConditions }];
        delete where.OR;
      } else {
        where.OR = textConditions;
      }
    }

    return where;
  }

  private buildSort(sortParam?: string): { orderBy: Prisma.AuditLogOrderByWithRelationInput } {
    if (!sortParam) return { orderBy: { createdAt: 'desc' } };
    const [fieldRaw, dirRaw] = sortParam.split(',');
    const fieldKey = (fieldRaw || 'createdAt').toLowerCase();
    const resolvedField = ALLOWED_SORT_FIELDS[fieldKey] || 'createdAt';
    const direction: Prisma.SortOrder = dirRaw?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    return { orderBy: { [resolvedField]: direction } };
  }
}
