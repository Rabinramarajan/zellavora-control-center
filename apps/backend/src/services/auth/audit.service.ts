/**
 * AuditService — write structured audit events.
 *
 * Used for: logins, logouts, MFA events, permission changes, role changes,
 * password changes, sensitive resource operations. All entries are tenant-
 * scoped and visible only to org members with `audit:read`.
 *
 * Pair with the SQL trigger (fn_audit_trigger) for auto-audit of resource
 * changes — this service is for events that have no specific row.
 */
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';

export type AuditSeverity = 'info' | 'warn' | 'critical';
export type AuditAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'lockout'
  | 'password_change'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'email_verified'
  | 'mfa_enrolled'
  | 'mfa_disabled'
  | 'mfa_recovery_used'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'user_invited'
  | 'permission_updated'
  | 'role_changed'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'session_revoked'
  | 'all_sessions_revoked'
  | 'tenant_switched'
  | 'resource_created'
  | 'resource_updated'
  | 'resource_deleted';

export interface AuditEvent {
  organizationId: string;
  actorId: string | null;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  description?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  static async log(event: AuditEvent): Promise<void> {
    const { error } = await supabaseAdmin.from('audit_logs').insert({
      organization_id: event.organizationId,
      actor_id: event.actorId,
      action: event.action,
      resource_type: event.resourceType ?? null,
      resource_id: event.resourceId ?? null,
      description: event.description ?? null,
      old_values: event.oldValues ?? null,
      new_values: event.newValues ?? null,
      ip_address: event.ipAddress ?? null,
      user_agent: event.userAgent ?? null,
      request_id: event.requestId ?? null,
      severity: event.severity ?? 'info',
      metadata: event.metadata ?? null,
    });
    if (error) {
      // Audit failures must NEVER break the user-facing flow.
      // Just log to server stderr; ops team can pick it up from logs.
      // eslint-disable-next-line no-console
      console.error('[audit] failed to write event', { event, error });
    }
  }

  /** Convenience for the high-frequency login-failure path. */
  static async logLoginFailure(input: {
    organizationId: string | null;
    email: string;
    reason: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<void> {
    if (!input.organizationId) return; // don't write a tenant-less audit row
    await this.log({
      organizationId: input.organizationId,
      actorId: null,
      action: 'login_failed',
      severity: 'warn',
      description: `Login failed for ${input.email}: ${input.reason}`,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }
}
