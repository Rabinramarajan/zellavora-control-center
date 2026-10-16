const claims = {
  sub: 'user-1',
  tid: 'org-1',
  role: 'owner',
  sid: 'session-1',
  email: 'u@example.com',
};
const loadForUser = jest.fn();

jest.mock('../infrastructure/prisma', () => ({ prisma: { user: { findUnique: jest.fn() } } }));
jest.mock('../services/auth', () => {
  const actual = jest.requireActual('../services/auth/permission.service');
  return {
    TokenService: { verifyAccess: jest.fn(async () => claims) },
    SessionService: { touchIfActive: jest.fn(async () => true) },
    PermissionService: {
      loadForUser: (...args: unknown[]) => loadForUser(...args),
      has: actual.PermissionService.has.bind(actual.PermissionService),
    },
  };
});
jest.mock('../modules/security-policy/security-policy.service', () => ({
  SecurityPolicyService: {
    forOrganization: jest.fn(async () => ({ login: { sessionIdleMinutes: 0 } })),
  },
}));

import type { Response } from 'express';
import { prisma } from '../infrastructure/prisma';
import { PermissionSet } from '../services/auth/permission.service';
import { adminAuthGuard } from '../modules/admin/middleware/admin-auth';
import {
  GUARD_MARK,
  authenticate,
  requirePermission,
  requirePlatformAdmin,
  resolvePlatformAdmin,
  type AuthRequest,
} from './auth';

const userFind = prisma.user.findUnique as jest.Mock;

const permissions = (allow: string[], deny: string[] = []) => {
  const set = new PermissionSet(allow);
  deny.forEach((code) => set.denied.add(code));
  return set;
};

/** Runs middleware and resolves with whatever it passed to next(). */
const run = (
  mw: (req: AuthRequest, res: Response, next: (err?: unknown) => void) => unknown,
  req: Partial<AuthRequest>
) =>
  new Promise<unknown>((resolve) => {
    void mw(req as AuthRequest, {} as Response, (err?: unknown) => resolve(err));
  });

const authed = (): AuthRequest =>
  ({ headers: { authorization: 'Bearer token' }, ip: '127.0.0.1' }) as unknown as AuthRequest;

describe('guard markers', () => {
  it('marks every guard so the route-guard spec can recognise it', () => {
    for (const guard of [
      authenticate,
      requirePermission('x:read'),
      requirePlatformAdmin,
      adminAuthGuard,
    ]) {
      expect((guard as unknown as Record<symbol, unknown>)[GUARD_MARK]).toBe(true);
    }
  });
});

describe('requirePlatformAdmin', () => {
  beforeEach(() => userFind.mockReset());

  it('refuses a tenant owner even though they hold the *:* wildcard', async () => {
    userFind.mockResolvedValue({ isPlatformAdmin: false, isDeleted: false, status: 'ACTIVE' });
    const err = await run(requirePlatformAdmin, { userId: 'user-1' });
    expect(err).toMatchObject({ status: 403, code: 'FORBIDDEN_PLATFORM' });
  });

  it('lets an active platform administrator through', async () => {
    userFind.mockResolvedValue({ isPlatformAdmin: true, isDeleted: false, status: 'ACTIVE' });
    expect(await run(requirePlatformAdmin, { userId: 'user-1' })).toBeUndefined();
  });

  it.each([
    ['deleted', { isPlatformAdmin: true, isDeleted: true, status: 'ACTIVE' }],
    ['locked', { isPlatformAdmin: true, isDeleted: false, status: 'LOCKED' }],
    ['missing', null],
  ])('refuses a platform administrator who is %s', async (_label, row) => {
    userFind.mockResolvedValue(row);
    const err = await run(requirePlatformAdmin, { userId: 'user-1' });
    expect(err).toMatchObject({ status: 403 });
  });

  it('answers 401 when there is no signed-in user', async () => {
    expect(await run(requirePlatformAdmin, {})).toMatchObject({ status: 401 });
  });

  it('looks the flag up once per request', async () => {
    userFind.mockResolvedValue({ isPlatformAdmin: true, isDeleted: false, status: 'ACTIVE' });
    const req = { userId: 'user-1' } as AuthRequest;
    await resolvePlatformAdmin(req);
    await resolvePlatformAdmin(req);
    expect(userFind).toHaveBeenCalledTimes(1);
  });
});

describe('requirePermission with deny rules', () => {
  beforeEach(() => loadForUser.mockReset());

  it('refuses a code that is denied even when a wildcard grants it', async () => {
    loadForUser.mockResolvedValue(permissions(['*:*'], ['users:manage']));
    const err = await run(requirePermission('users:manage'), {
      userId: 'user-1',
      tenantId: 'org-1',
    });
    expect(err).toMatchObject({ status: 403, code: 'FORBIDDEN_PERMISSION' });
  });

  it('allows a code that is granted and not denied', async () => {
    loadForUser.mockResolvedValue(permissions(['users:read']));
    expect(
      await run(requirePermission('users:read'), { userId: 'user-1', tenantId: 'org-1' })
    ).toBeUndefined();
  });
});

describe('adminAuthGuard', () => {
  beforeEach(() => {
    loadForUser.mockReset();
    userFind.mockReset();
    userFind.mockResolvedValue({ isPlatformAdmin: false, isDeleted: false, status: 'ACTIVE' });
  });

  it('answers 401 without a token', async () => {
    const err = await run(adminAuthGuard, { headers: {} } as unknown as Partial<AuthRequest>);
    expect(err).toMatchObject({ status: 401, code: 'NO_TOKEN' });
  });

  it('no longer lets a member through just because they have a role', async () => {
    loadForUser.mockResolvedValue(permissions(['notifications:read']));
    const err = await run(adminAuthGuard, authed());
    expect(err).toMatchObject({ status: 403, code: 'FORBIDDEN_PERMISSION' });
  });

  it('admits a caller holding admin:access', async () => {
    loadForUser.mockResolvedValue(permissions(['admin:access']));
    expect(await run(adminAuthGuard, authed())).toBeUndefined();
  });

  it('admits an owner through the *:* wildcard', async () => {
    loadForUser.mockResolvedValue(permissions(['*:*']));
    expect(await run(adminAuthGuard, authed())).toBeUndefined();
  });

  it('admits a platform administrator without checking tenant permissions', async () => {
    userFind.mockResolvedValue({ isPlatformAdmin: true, isDeleted: false, status: 'ACTIVE' });
    expect(await run(adminAuthGuard, authed())).toBeUndefined();
    expect(loadForUser).not.toHaveBeenCalled();
  });
});
