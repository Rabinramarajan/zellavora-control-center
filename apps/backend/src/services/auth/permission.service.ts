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
import { AppError } from '../../middleware/error';

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

  /** Pure check: does a permission set include a code (or any code with the action wildcard)? */
  static has(set: Set<string>, code: string): boolean {
    if (set.has(code)) return true;
    // Wildcard: 'projects:*' matches 'projects:read'
    const action = code.split(':')[1];
    return !!action && set.has(`*:${action}`);
  }
}
