/**
 * TenantService — organization lookup, membership, and switch-context.
 *
 * The "tenant" is an `organizations` row. The user-facing identifier is the
 * `client_code` (e.g. "ACME"). All RLS policies and JWT `tid` claims refer
 * to the org id, not the client_code.
 */
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';
import { prisma } from '../../infrastructure/prisma';

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

    // Use Prisma for direct DB access (bypasses PostgREST schema cache)
    const org = await prisma.organization.findFirst({
      where: {
        clientCode: { equals: code, mode: 'insensitive' },
      },
    });

    if (!org) {
      // Use a generic message — don't leak whether the code exists
      throw new AppError('Invalid client code or credentials', 401, 'INVALID_CREDENTIALS');
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.clientCode,
      clientCode: org.clientCode,
      logoUrl: org.logoUrl,
      plan: org.plan,
      status: 'active', // Prisma Tenant model doesn't track status; assume active
      enforce2fa: org.enforce2fa,
      enforceSso: false,
      allowedDomains: org.allowedDomains as string[] | null,
      maxMembers: 999,
      createdAt: org.createdAt.toISOString(),
    };
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
      .select(
        `
        role,
        organization:organizations(*)
      `
      )
      .eq('user_id', userId);

    if (error) throw new AppError('Failed to list tenants', 500, 'TENANT_LIST_FAILED');
    const rows = (data ?? []).map((row: any) => ({
      ...toTenant(row.organization),
      role: row.role,
    }));
    if (rows.length) return rows;

    // Same fallback as assertMembership: users linked only via users.tenant_id.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, tenantId: true },
    });
    if (!user?.tenantId) return [];
    const tenant = await TenantService.getById(user.tenantId);
    return tenant ? [{ ...tenant, role: user.role }] : [];
  }

  /** Confirm the user is an active member of the org (used during login & switch). */
  static async assertMembership(userId: string, orgId: string): Promise<string> {
    const membership = await prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId: orgId } },
      select: { role: true },
    });
    if (membership) return membership.role;

    // No explicit membership row: fall back to the user's own tenant, which is
    // what login authorizes against (users.tenant_id + users.role). Many users
    // predate organization_members and only have this link.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, tenantId: true, isDeleted: true },
    });
    if (!user || user.isDeleted || user.tenantId !== orgId) {
      throw new AppError('User is not a member of this organization', 403, 'NOT_A_MEMBER');
    }
    return user.role;
  }
}
