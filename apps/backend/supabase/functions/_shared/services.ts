import { getSupabaseAdmin } from './db.ts';
import { AppError } from './errors.ts';

// ============================================================================
// TENANT SERVICE
// ============================================================================
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  clientCode: string;
  logoUrl: string | null;
  plan: string;
  status: string;
  enforce2fa: boolean;
  enforceSso: boolean;
  allowedDomains: string[] | null;
  maxMembers: number;
  createdAt: string;
}

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  client_code: string;
  logo_url: string | null;
  plan: string;
  status: string;
  enforce_2fa: boolean;
  enforce_sso: boolean;
  allowed_domains: string[] | null;
  max_members: number;
  created_at: string;
}

const toTenant = (r: OrgRow): Tenant => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  clientCode: r.client_code,
  logoUrl: r.logo_url,
  plan: r.plan,
  status: r.status,
  enforce2fa: r.enforce_2fa,
  enforceSso: r.enforce_sso,
  allowedDomains: r.allowed_domains,
  maxMembers: r.max_members,
  createdAt: r.created_at,
});

export class TenantService {
  static async resolveByClientCode(code: string): Promise<Tenant> {
    if (!code || code.length < 2 || code.length > 16) {
      throw new AppError('Invalid client code format', 400, 'INVALID_CLIENT_CODE');
    }
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('organizations')
      .select('*')
      .ilike('client_code', code)
      .maybeSingle();

    if (error || !data) {
      throw new AppError('Invalid client code or credentials', 401, 'INVALID_CREDENTIALS');
    }
    if (data.status !== 'active') {
      throw new AppError('This organization is not currently active', 403, 'ORG_INACTIVE');
    }
    return toTenant(data as OrgRow);
  }

  static async getById(orgId: string): Promise<Tenant | null> {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();
    return data ? toTenant(data as OrgRow) : null;
  }

  static async listForUser(userId: string): Promise<Array<Tenant & { role: string }>> {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('organization_members')
      .select(`
        role,
        organization:organizations(*)
      `)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) throw new AppError('Failed to list tenants', 500, 'TENANT_LIST_FAILED');
    return (data ?? []).map((row: any) => ({
      ...toTenant(row.organization),
      role: row.role,
    }));
  }

  static async assertMembership(userId: string, orgId: string): Promise<string> {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !data) {
      throw new AppError('User is not a member of this organization', 403, 'NOT_A_MEMBER');
    }
    return data.role;
  }
}

// ============================================================================
// SESSION SERVICE
// ============================================================================
export interface CreateSessionInput {
  userId: string;
  organizationId: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  rememberMe?: boolean;
}

export interface SessionRow {
  id: string;
  user_id: string;
  organization_id: string;
  session_token: string;
  refresh_token_hash: string | null;
  refresh_token_family: string | null;
  ip_address: string;
  user_agent: string;
  device_fingerprint: string | null;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export class SessionService {
  static async create(input: CreateSessionInput): Promise<{ sessionId: string }> {
    const sessionId = crypto.randomUUID();
    const sessionToken = `sess_${crypto.randomUUID().replace(/-/g, '')}`;
    const expiresAt = new Date(
      Date.now() + (input.rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000
    );

    const admin = getSupabaseAdmin();
    const { error } = await admin.from('sessions').insert({
      id: sessionId,
      user_id: input.userId,
      organization_id: input.organizationId,
      session_token: sessionToken,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      device_fingerprint: input.deviceFingerprint ?? null,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      throw new AppError('Failed to create session', 500, 'SESSION_CREATE_FAILED');
    }
    return { sessionId };
  }

  static async getActive(sessionId: string): Promise<SessionRow> {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) {
      throw new AppError('Session not found or expired', 401, 'SESSION_INVALID');
    }
    return data as SessionRow;
  }

  static async findByRefreshTokenHash(hash: string): Promise<SessionRow> {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('sessions')
      .select('*')
      .eq('refresh_token_hash', hash)
      .maybeSingle();

    if (error) throw new AppError('Session lookup failed', 500, 'SESSION_LOOKUP_FAILED');
    if (!data) throw new AppError('Refresh token not recognised', 401, 'REFRESH_TOKEN_UNKNOWN');

    if (data.revoked_at) {
      await admin
        .from('sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('refresh_token_family', data.refresh_token_family)
        .is('revoked_at', null);
      throw new AppError('Refresh token reuse detected', 401, 'REFRESH_TOKEN_REUSE');
    }

    return data as SessionRow;
  }

  static async touch(sessionId: string): Promise<void> {
    const admin = getSupabaseAdmin();
    await admin
      .from('sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', sessionId);
  }

  static async listForUser(userId: string): Promise<SessionRow[]> {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('last_activity_at', { ascending: false });

    if (error) throw new AppError('Failed to list sessions', 500, 'SESSION_LIST_FAILED');
    return (data ?? []) as SessionRow[];
  }
}

// ============================================================================
// AUDIT SERVICE
// ============================================================================
export type AuditSeverity = 'info' | 'warn' | 'critical';
export type AuditAction =
  | 'login' | 'logout' | 'login_failed' | 'lockout'
  | 'password_change' | 'password_reset_requested' | 'password_reset_completed'
  | 'email_verified' | 'mfa_enrolled' | 'mfa_disabled' | 'mfa_recovery_used'
  | 'user_created' | 'user_updated' | 'user_deleted' | 'user_invited'
  | 'permission_updated' | 'role_changed'
  | 'api_key_created' | 'api_key_revoked'
  | 'session_revoked' | 'all_sessions_revoked'
  | 'tenant_switched'
  | 'resource_created' | 'resource_updated' | 'resource_deleted';

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
    const admin = getSupabaseAdmin();
    const { error } = await admin.from('audit_logs').insert({
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
      console.error('[audit] failed to write event', { event, error });
    }
  }

  static async logLoginFailure(input: {
    organizationId: string | null;
    email: string;
    reason: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<void> {
    if (!input.organizationId) return;
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

// ============================================================================
// RATE LIMIT SERVICE
// ============================================================================
const WINDOW_MS = 15 * 60 * 1000;
const IP_LIMIT = 10;
const ACCOUNT_LIMIT = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export class RateLimitService {
  static async record(input: {
    email: string;
    clientCode?: string;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    failureReason?: string;
  }): Promise<void> {
    const admin = getSupabaseAdmin();
    await admin.from('login_attempts').insert({
      email: input.email.toLowerCase(),
      client_code: input.clientCode ?? null,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      success: input.success,
      failure_reason: input.failureReason ?? null,
    });
  }

  static async assertIpAllowed(ipAddress: string): Promise<void> {
    const admin = getSupabaseAdmin();
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count } = await admin
      .from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ipAddress)
      .eq('success', false)
      .gte('attempted_at', since);
    if ((count ?? 0) >= IP_LIMIT) {
      throw new AppError('Too many failed attempts. Try again in 15 minutes.', 429, 'RATE_LIMITED_IP');
    }
  }

  static async assertAccountAllowed(email: string): Promise<{ lockedUntil: Date | null; failedAttempts: number }> {
    const admin = getSupabaseAdmin();
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count } = await admin
      .from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('email', email.toLowerCase())
      .eq('success', false)
      .gte('attempted_at', since);

    const failedAttempts = count ?? 0;
    if (failedAttempts >= ACCOUNT_LIMIT) {
      throw new AppError('Account temporarily locked. Try again later.', 423, 'ACCOUNT_LOCKED');
    }
    return { lockedUntil: null, failedAttempts };
  }

  static async clearForEmail(email: string): Promise<void> {
    const admin = getSupabaseAdmin();
    await admin
      .from('login_attempts')
      .delete()
      .eq('email', email.toLowerCase());
  }
}
