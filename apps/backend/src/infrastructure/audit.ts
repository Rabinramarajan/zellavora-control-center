/**
 * Prisma-backed AuditService — writes structured audit events to the AuditLog
 * table. Unlike the Supabase-flavoured services/auth/audit.service.ts, this one
 * runs through the same Prisma client as the clean modules and honours the
 * request context set by the `requestContext` middleware (actor, tenant, ip,
 * user-agent, request-id).
 *
 * Audit writes are best-effort: a failure must never break the user-facing
 * flow, so errors are logged to stderr and swallowed.
 */
import { prisma, type TxClient } from './prisma';
import { getRequestContext } from './request-context';
import type { Prisma } from '@prisma/client';

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AuditEventInput {
  action: string;
  resource: string;
  resourceId?: string | null;
  organizationId?: string;
  severity?: AuditSeverity;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export class AuditService {
  static async log(input: AuditEventInput, tx?: TxClient): Promise<void> {
    try {
      const ctx = getRequestContext();
      await (tx ?? prisma).auditLog.create({
        data: {
          actorId: input.actorId ?? ctx.actorId ?? null,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId ?? null,
          organizationId: input.organizationId ?? ctx.organizationId ?? '',
          severity: input.severity ?? 'info',
          ipAddress: input.ipAddress ?? ctx.ipAddress ?? null,
          userAgent: input.userAgent ?? ctx.userAgent ?? null,
          requestId: input.requestId ?? ctx.requestId ?? null,
          metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[audit] failed to write event', { action: input.action, error: err });
    }
  }
}
