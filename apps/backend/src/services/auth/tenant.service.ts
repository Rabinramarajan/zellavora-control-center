/**
 * TenantService — organization lookup, membership, and switch-context.
 *
 * The "tenant" is an `organizations` row. The user-facing identifier is the
 * `client_code` (e.g. "ACME"). All RLS policies and JWT `tid` claims refer
 * to the org id, not the client_code.
 */
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

export class TenantService {
  private static prismaTenantToTenant(org: any): Tenant {
    return {
      id: org.id,
      name: org.name,
      slug: org.clientCode,
      clientCode: org.clientCode,
      logoUrl: org.logoUrl,
      plan: org.plan,
      status: 'active',
      enforce2fa: org.enforce2fa,
      enforceSso: false,
      allowedDomains: org.allowedDomains as string[] | null,
      maxMembers: 999,
      createdAt: org.createdAt.toISOString(),
    };
  }

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
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return null;
    return {
      id: org.id,
      name: org.name,
      slug: org.clientCode,
      clientCode: org.clientCode,
      logoUrl: org.logoUrl,
      plan: org.plan,
      status: 'active',
      enforce2fa: org.enforce2fa,
      enforceSso: false,
      allowedDomains: org.allowedDomains as string[] | null,
      maxMembers: 999,
      createdAt: org.createdAt.toISOString(),
    };
  }

  /** All tenants a user is a member of (for the tenant-switcher dropdown). */
  static async listForUser(userId: string): Promise<Array<Tenant & { role: string }>> {
    const memberships = await prisma.userTenant.findMany({
      where: { userId },
      include: { tenant: true },
    });
    const fromMemberships = memberships.map((m) => ({
      ...TenantService.fromOrganization(m.tenant),
      role: m.role,
    }));
    if (fromMemberships.length) return fromMemberships;

    // Same fallback as assertMembership: users linked only via users.tenant_id.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, tenantId: true },
    });
    if (!user?.tenantId) return [];
    const tenant = await TenantService.getById(user.tenantId);
    return tenant ? [{ ...tenant, role: user.role }] : [];
  }

  /** Map a Prisma Organization row to the Tenant projection. */
  private static fromOrganization(org: {
    id: string;
    name: string;
    clientCode: string;
    logoUrl: string | null;
    plan: string;
    enforce2fa: boolean;
    allowedDomains: unknown;
    createdAt: Date;
  }): Tenant {
    return {
      id: org.id,
      name: org.name,
      slug: org.clientCode,
      clientCode: org.clientCode,
      logoUrl: org.logoUrl,
      plan: org.plan,
      status: 'active',
      enforce2fa: org.enforce2fa,
      enforceSso: false,
      allowedDomains: org.allowedDomains as string[] | null,
      maxMembers: 999,
      createdAt: org.createdAt.toISOString(),
    };
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
