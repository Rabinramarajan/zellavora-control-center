/**
 * TenantService — organization lookup, membership, and switch-context.
 *
 * The "tenant" is an `organizations` row. The user-facing identifier is the
 * `client_code` (e.g. "ACME"). All RLS policies and JWT `tid` claims refer
 * to the org id, not the client_code.
 */
import { supabaseAdmin } from '@/config/supabase';
import { AppError } from '@/middleware/error';

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
  /** Resolve a client_code (case-insensitive) to a tenant. Used at the start of login. */
  static async resolveByClientCode(code: string): Promise<Tenant> {
    if (!code || code.length < 2 || code.length > 16) {
      throw new AppError('Invalid client code format', 400, 'INVALID_CLIENT_CODE');
    }
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .ilike('client_code', code)
      .maybeSingle();

    if (error || !data) {
      // Use a generic message — don't leak whether the code exists
      throw new AppError('Invalid client code or credentials', 401, 'INVALID_CREDENTIALS');
    }
    if (data.status !== 'active') {
      throw new AppError('This organization is not currently active', 403, 'ORG_INACTIVE');
    }
    return toTenant(data as OrgRow);
  }

  /** Get a tenant by id (for the /auth/me payload). */
  static async getById(orgId: string): Promise<Tenant | null> {
    const { data } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();
    return data ? toTenant(data as OrgRow) : null;
  }

  /** All tenants a user is a member of (for the tenant-switcher dropdown). */
  static async listForUser(userId: string): Promise<Array<Tenant & { role: string }>> {
    const { data, error } = await supabaseAdmin
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

  /** Confirm the user is an active member of the org (used during login & switch). */
  static async assertMembership(userId: string, orgId: string): Promise<string> {
    const { data, error } = await supabaseAdmin
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
