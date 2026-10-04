import { z } from 'zod';

export const AuditStatusEnum = z.enum(['SUCCESS', 'FAILURE', 'PARTIAL']);

export const AuditSearchQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.string().optional().default('createdAt,desc'),
  dateFrom: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional()),
  dateTo: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional()),
  user: z.string().optional(),
  module: z.string().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  status: z.string().optional(),
  ipAddress: z.string().optional(),
  correlationId: z.string().optional(),
  searchText: z.string().optional(),
});

export type AuditSearchQuery = z.infer<typeof AuditSearchQuerySchema>;

export const CreateAuditRecordSchema = z.object({
  organizationId: z.string().uuid(),
  actorId: z.string().uuid().nullable().optional(),
  action: z.string().min(1),
  module: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  resourceName: z.string().optional(),
  httpMethod: z.string().optional(),
  endpoint: z.string().optional(),
  status: AuditStatusEnum.default('SUCCESS'),
  severity: z.enum(['info', 'warn', 'critical']).default('info'),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  correlationId: z.string().nullable().optional(),
  beforeData: z.record(z.unknown()).nullable().optional(),
  afterData: z.record(z.unknown()).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
});

export type CreateAuditRecordInput = z.infer<typeof CreateAuditRecordSchema>;

export interface AuditSearchItemDto {
  auditId: string;
  timestamp: string;
  user: {
    id: string | null;
    username: string | null;
    email: string | null;
    name: string | null;
  };
  module: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  resourceName: string | null;
  status: string;
  ipAddress: string | null;
  correlationId: string | null;
}

export interface AuditDetailDto {
  auditId: string;
  timestamp: string;
  module: string;
  action: string;
  status: string;
  severity: string;
  actor: {
    userId: string | null;
    username: string | null;
    email: string | null;
    name: string | null;
  };
  resource: {
    type: string | null;
    id: string | null;
    name: string | null;
  };
  request: {
    method: string | null;
    endpoint: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    correlationId: string | null;
  };
  changes: Array<{
    field: string;
    previousValue: unknown;
    newValue: unknown;
  }>;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  error?: {
    code: string | null;
    message: string | null;
  } | null;
}

export interface AuditFilterOptionsDto {
  modules: string[];
  actions: string[];
  resourceTypes: string[];
  statuses: string[];
}
