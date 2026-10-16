jest.mock('../../infrastructure/prisma', () => ({
  prisma: {
    userRoleAssignment: { findMany: jest.fn() },
    userGroup: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    role: { findFirst: jest.fn() },
  },
}));
jest.mock('../../infrastructure/cache', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDelPattern: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../config/env', () => ({ config: { permissionRoleNameFallback: false } }));

import { prisma } from '../../infrastructure/prisma';
import { cacheDelPattern, cacheGet, cacheSet } from '../../infrastructure/cache';
import { config } from '../../config/env';
import { PermissionService } from './permission.service';

const assignments = prisma.userRoleAssignment.findMany as jest.Mock;
const memberships = prisma.userGroup.findMany as jest.Mock;
const userFind = prisma.user.findUnique as jest.Mock;
const roleFind = prisma.role.findFirst as jest.Mock;

type Grant = [string, 'allow' | 'deny'];
const role = (...grants: Grant[]) => ({
  rolePermissions: grants.map(([key, effect]) => ({ effect, permission: { key } })),
});
const direct = (...grants: Grant[]) => ({ role: role(...grants) });
const viaGroup = (...roles: ReturnType<typeof role>[]) => ({
  group: { groupRoles: roles.map((r) => ({ role: r })) },
});
const setFallback = (on: boolean) => {
  (config as { permissionRoleNameFallback: boolean }).permissionRoleNameFallback = on;
};

describe('PermissionService.loadForUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (cacheGet as jest.Mock).mockResolvedValue(null);
    assignments.mockResolvedValue([]);
    memberships.mockResolvedValue([]);
    setFallback(false);
  });

  it('only asks for roles that are ACTIVE, not deleted and in the organization', async () => {
    await PermissionService.loadForUser('user-1', 'org-1');

    const activeRole = {
      status: 'ACTIVE',
      isDeleted: false,
      OR: [{ organizationId: 'org-1' }, { organizationId: null }],
    };
    expect(assignments.mock.calls[0][0].where).toEqual({
      userId: 'user-1',
      organizationId: 'org-1',
      role: activeRole,
    });
    const groupQuery = memberships.mock.calls[0][0];
    expect(groupQuery.where.group).toEqual({ status: 'ACTIVE', isDeleted: false });
    expect(groupQuery.select.group.select.groupRoles.where).toEqual({ role: activeRole });
  });

  it('grants the codes of directly assigned roles', async () => {
    assignments.mockResolvedValue([direct(['users:read', 'allow'], ['roles:read', 'allow'])]);
    const set = await PermissionService.loadForUser('user-1', 'org-1');
    expect(PermissionService.has(set, 'users:read')).toBe(true);
    expect(PermissionService.has(set, 'roles:read')).toBe(true);
    expect(PermissionService.has(set, 'users:manage')).toBe(false);
  });

  it('grants the codes of roles reached through a group', async () => {
    memberships.mockResolvedValue([viaGroup(role(['reports:read', 'allow']))]);
    const set = await PermissionService.loadForUser('user-1', 'org-1');
    expect(PermissionService.has(set, 'reports:read')).toBe(true);
  });

  it('lets a deny on any role cancel an allow from another role', async () => {
    assignments.mockResolvedValue([
      direct(['users:manage', 'allow']),
      direct(['users:manage', 'deny']),
    ]);
    const set = await PermissionService.loadForUser('user-1', 'org-1');
    expect(PermissionService.has(set, 'users:manage')).toBe(false);
  });

  it('lets a direct deny cancel a group-granted allow', async () => {
    assignments.mockResolvedValue([direct(['billing:read', 'deny'])]);
    memberships.mockResolvedValue([viaGroup(role(['billing:read', 'allow']))]);
    const set = await PermissionService.loadForUser('user-1', 'org-1');
    expect(PermissionService.has(set, 'billing:read')).toBe(false);
  });

  it('applies a deny to codes covered by a wildcard grant', async () => {
    assignments.mockResolvedValue([direct(['*:*', 'allow'], ['users:manage', 'deny'])]);
    const set = await PermissionService.loadForUser('user-1', 'org-1');
    expect(PermissionService.has(set, 'users:manage')).toBe(false);
    expect(PermissionService.has(set, 'users:read')).toBe(true);
  });

  it('applies a wildcard deny to every action on the resource', async () => {
    assignments.mockResolvedValue([direct(['users:read', 'allow'], ['users:*', 'deny'])]);
    const set = await PermissionService.loadForUser('user-1', 'org-1');
    expect(PermissionService.has(set, 'users:read')).toBe(false);
  });

  it('gives nothing to a user with no assignment, even if a role shares their role name', async () => {
    userFind.mockResolvedValue({ role: 'admin' });
    roleFind.mockResolvedValue(role(['users:manage', 'allow']));
    const set = await PermissionService.loadForUser('user-1', 'org-1');
    expect(set.size).toBe(0);
    expect(userFind).not.toHaveBeenCalled();
    expect(roleFind).not.toHaveBeenCalled();
  });

  it('only falls back to the role named after users.role when the flag is on', async () => {
    setFallback(true);
    userFind.mockResolvedValue({ role: 'admin' });
    roleFind.mockResolvedValue(role(['users:manage', 'allow']));
    const set = await PermissionService.loadForUser('user-1', 'org-1');
    expect(PermissionService.has(set, 'users:manage')).toBe(true);
    expect(roleFind.mock.calls[0][0].where).toMatchObject({ status: 'ACTIVE', isDeleted: false });
  });

  it('caches the computed set briefly, deny list included', async () => {
    assignments.mockResolvedValue([direct(['a:read', 'allow'], ['b:read', 'deny'])]);
    await PermissionService.loadForUser('user-1', 'org-1');
    expect(cacheSet).toHaveBeenCalledWith(
      'iam:perms:org-1:user-1',
      { allow: ['a:read'], deny: ['b:read'] },
      30
    );
  });

  it('restores the deny list from the cache', async () => {
    (cacheGet as jest.Mock).mockResolvedValue({ allow: ['*:*'], deny: ['users:manage'] });
    const set = await PermissionService.loadForUser('user-1', 'org-1');
    expect(assignments).not.toHaveBeenCalled();
    expect(PermissionService.has(set, 'users:manage')).toBe(false);
    expect(PermissionService.has(set, 'users:read')).toBe(true);
  });

  it('drops every cached set on invalidate', () => {
    PermissionService.invalidate();
    expect(cacheDelPattern).toHaveBeenCalledWith('iam:perms:*');
  });
});

describe('PermissionService.has', () => {
  it('keeps the wildcard rules for plain sets', () => {
    const set = new Set(['users:*', '*:read']);
    expect(PermissionService.has(set, 'users:role:assign')).toBe(true);
    expect(PermissionService.has(set, 'projects:read')).toBe(true);
    expect(PermissionService.has(set, 'projects:write')).toBe(false);
  });
});
