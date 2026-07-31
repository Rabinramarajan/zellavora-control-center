/**
 * AuditService — append-only log writer.
 *
 * - Uses the append_audit_log() SQL function for hash-chained integrity.
 * - Hot path: small entries flushed via BullMQ (out-of-process).
 * - Cold path: large bulk writes batched and written directly.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuditEntry {
  organizationId: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  decision?: 'allow' | 'deny';
  permissionKey?: string;
  description?: string;
  oldValues?: unknown;
  newValues?: unknown;
  context?: Record<string, unknown>;
}

export class AuditService {
  constructor(private db: SupabaseClient) {}

  /**
   * Append a single audit entry. For hot-path events (deny, login, mfa).
   */
  async log(entry: AuditEntry): Promise<number> {
    const { data, error } = await this.db.rpc('append_audit_log', {
      p_org_id: entry.organizationId,
      p_actor_id: entry.actorId ?? null,
      p_actor_email: entry.actorEmail ?? null,
      p_action: entry.action,
      p_resource_type: entry.resourceType ?? null,
      p_resource_id: entry.resourceId ?? null,
      p_decision: entry.decision ?? null,
      p_permission_key: entry.permissionKey ?? null,
      p_description: entry.description ?? null,
      p_old_values: entry.oldValues ? JSON.stringify(entry.oldValues) : null,
      p_new_values: entry.newValues ? JSON.stringify(entry.newValues) : null,
      p_context: JSON.stringify(entry.context ?? {}),
    });
    if (error) throw new Error(`Audit log failed: ${error.message}`);
    return data as number;
  }

  /**
   * Search audit logs with pagination.
   */
  async search(
    orgId: string,
    opts: {
      actor?: string;
      action?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
    const offset = (page - 1) * pageSize;

    let q = this.db
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (opts.actor) q = q.eq('actor_id', opts.actor);
    if (opts.action) q = q.eq('action', opts.action);
    if (opts.from) q = q.gte('created_at', opts.from);
    if (opts.to) q = q.lte('created_at', opts.to);

    const { data, count, error } = await q;
    if (error) throw new Error(`Audit search failed: ${error.message}`);

    return {
      data: data ?? [],
      pagination: {
        page,
        pageSize,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      },
    };
  }

  /**
   * Verify the hash chain for an org.
   * Returns the first index where the chain breaks, or null if intact.
   */
  async verifyChain(orgId: string): Promise<number | null> {
    const { data, error } = await this.db.rpc('verify_audit_chain', {
      p_org_id: orgId,
    });
    if (error) throw new Error(`Chain verify failed: ${error.message}`);
    return data as number | null;
  }
}
