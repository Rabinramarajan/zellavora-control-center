/**
 * PermissionService — load the effective permission set for a (user, org) pair
 * and provide an in-memory has() check.
 *
 * Permissions are derived from the Prisma RBAC tables (PRISMA):
 *   user_role_assignments → roles → role_permissions → permissions.key
 * Instead of the Supabase view `v_user_effective_permissions`, we walk the
 * explicit assignments within the org. The wildcard `*:action` matching is
 * still applied.
 */
import { prisma } from '../../infrastructure/prisma';

export class PermissionService {
  /** Load the user's permission codes within an organization. */
  static async loadForUser(userId: string, orgId: string): Promise<Set<string>> {
    const assignments = await prisma.userRoleAssignment.findMany({
      where: { userId, organizationId: orgId },
      include: {
        role: {
          include: {
            rolePermissions: {
              where: { effect: 'allow' },
              include: { permission: true },
            },
          },
        },
      },
    });

    const codes = new Set<string>();
    for (const assignment of assignments) {
      for (const rp of assignment.role.rolePermissions) {
        if (rp.permission?.key) codes.add(rp.permission.key);
      }
    }

    // Fall back to the user's own role name if it matches a seeded role.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, tenantId: true },
    });
    if (user && !codes.size) {
      const role = await prisma.role.findFirst({
        where: { name: { equals: user.role, mode: 'insensitive' }, organizationId: orgId },
        include: { rolePermissions: { include: { permission: true } } },
      });
      if (role) {
        for (const rp of role.rolePermissions) {
          if (rp.permission?.key) codes.add(rp.permission.key);
        }
      }
    }

    return codes;
  }

  /**
   * Pure check: does a permission set grant a code?
   *
   * Codes are `resource:action`, with a few three-segment ones
   * (`system:audit:read`). Three wildcard forms are honoured:
   *   `*:*`            — full access (the Owner grant)
   *   `resource:*`     — every action on a resource, at any depth
   *   `*:action`       — one action across every resource
   */
  static has(set: Set<string>, code: string): boolean {
    if (set.has(code)) return true;
    if (set.has("*:*")) return true;

    const segments = code.split(":");
    const action = segments[segments.length - 1];
    if (action && set.has(`*:${action}`)) return true;

    // Prefix wildcards, so `system:*` covers `system:audit:read` and
    // `users:*` covers both `users:read` and `users:role:assign`.
    for (let i = 1; i < segments.length; i++) {
      if (set.has(`${segments.slice(0, i).join(":")}:*`)) return true;
    }

    return false;
  }
}
