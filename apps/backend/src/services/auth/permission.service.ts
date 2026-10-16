/**
 * PermissionService — load the effective permission set for a (user, org) pair
 * and provide an in-memory has() check.
 *
 * A user's roles come from two places, both limited to roles that are ACTIVE and
 * not deleted:
 *   - direct assignments:  user_role_assignments → roles
 *   - group membership:    user_groups → groups → group_roles → roles
 * Each role contributes its role_permissions rows. A `deny` row on any of those roles
 * removes the permission, whatever other roles allow: deny always wins. The wildcard
 * `*:action` matching of has() is applied to denies as well as grants.
 */
import { config } from '../../config/env';
import { cacheDelPattern, cacheGet, cacheSet } from '../../infrastructure/cache';
import { prisma } from '../../infrastructure/prisma';

const CACHE_KEY_PREFIX = 'iam:perms:';
/** Short on purpose: it bounds how long a missed invalidation can keep a revoked grant alive. */
const CACHE_TTL_SECONDS = 30;

/** Granted codes, plus the codes that are denied and so override any grant. */
export class PermissionSet extends Set<string> {
  readonly denied = new Set<string>();
}

interface CachedPermissions {
  allow: string[];
  deny: string[];
}

const toSet = ({ allow, deny }: CachedPermissions): PermissionSet => {
  const set = new PermissionSet(allow);
  for (const code of deny) set.denied.add(code);
  return set;
};

export class PermissionService {
  /** Load the user's permission codes within an organization. */
  static async loadForUser(userId: string, orgId: string): Promise<PermissionSet> {
    const key = `${CACHE_KEY_PREFIX}${orgId}:${userId}`;
    const cached = await cacheGet<CachedPermissions>(key).catch(() => null);
    if (cached) return toSet(cached);

    const computed = await this.compute(userId, orgId);
    await cacheSet(
      key,
      { allow: [...computed], deny: [...computed.denied] } satisfies CachedPermissions,
      CACHE_TTL_SECONDS
    ).catch(() => undefined);
    return computed;
  }

  /** Drop every cached permission set. Call after any change to roles, groups or assignments. */
  static invalidate(): void {
    try {
      void Promise.resolve(cacheDelPattern(`${CACHE_KEY_PREFIX}*`)).catch(() => undefined);
    } catch {
      // Best effort: the 30 second TTL bounds how long a stale set can survive.
    }
  }

  private static async compute(userId: string, orgId: string): Promise<PermissionSet> {
    const activeRole = {
      status: 'ACTIVE' as const,
      isDeleted: false,
      OR: [{ organizationId: orgId }, { organizationId: null }],
    };
    const roleSelect = {
      rolePermissions: { select: { effect: true, permission: { select: { key: true } } } },
    };

    const [assignments, memberships] = await Promise.all([
      prisma.userRoleAssignment.findMany({
        where: { userId, organizationId: orgId, role: activeRole },
        select: { role: { select: roleSelect } },
      }),
      prisma.userGroup.findMany({
        where: { userId, group: { status: 'ACTIVE', isDeleted: false } },
        select: {
          group: {
            select: {
              groupRoles: { where: { role: activeRole }, select: { role: { select: roleSelect } } },
            },
          },
        },
      }),
    ]);

    const roles = [
      ...assignments.map((a) => a.role),
      ...memberships.flatMap((m) => m.group.groupRoles.map((gr) => gr.role)),
    ];
    const result = this.collect(roles);
    if (result.size || !config.permissionRoleNameFallback) return result;

    // Opt-in only (PERMISSION_ROLE_NAME_FALLBACK=true): users with no assignment get the
    // role that shares the name of users.role. Prefer explicit assignments.
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) return result;
    const named = await prisma.role.findFirst({
      where: {
        ...activeRole,
        name: { equals: user.role, mode: 'insensitive' },
        organizationId: orgId,
      },
      select: roleSelect,
    });
    return named ? this.collect([named]) : result;
  }

  private static collect(
    roles: Array<{ rolePermissions: Array<{ effect: string; permission: { key: string } | null }> }>
  ): PermissionSet {
    const set = new PermissionSet();
    for (const role of roles) {
      for (const rp of role.rolePermissions) {
        const code = rp.permission?.key;
        if (!code) continue;
        if (rp.effect?.toLowerCase() === 'deny') set.denied.add(code);
        else set.add(code);
      }
    }
    // An exactly-denied code is not a grant at all; wildcard denies are applied by has().
    for (const code of set.denied) set.delete(code);
    return set;
  }

  /**
   * Pure check: does a permission set grant a code?
   *
   * Codes are `resource:action`, with a few three-segment ones
   * (`system:audit:read`). Three wildcard forms are honoured:
   *   `*:*`            — full access (the Owner grant)
   *   `resource:*`     — every action on a resource, at any depth
   *   `*:action`       — one action across every resource
   * Denies use the same forms and always override grants.
   */
  static has(set: Set<string>, code: string): boolean {
    if (set instanceof PermissionSet && set.denied.size && this.matches(set.denied, code)) {
      return false;
    }
    return this.matches(set, code);
  }

  private static matches(set: Set<string>, code: string): boolean {
    if (set.has(code)) return true;
    if (set.has('*:*')) return true;

    const segments = code.split(':');
    const action = segments[segments.length - 1];
    if (action && set.has(`*:${action}`)) return true;

    // Prefix wildcards, so `system:*` covers `system:audit:read` and
    // `users:*` covers both `users:read` and `users:role:assign`.
    for (let i = 1; i < segments.length; i++) {
      if (set.has(`${segments.slice(0, i).join(':')}:*`)) return true;
    }

    return false;
  }
}
