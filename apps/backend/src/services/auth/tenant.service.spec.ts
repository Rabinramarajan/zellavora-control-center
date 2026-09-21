jest.mock('../../infrastructure/prisma', () => ({
  prisma: {
    userTenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

import { prisma } from '../../infrastructure/prisma';
import { TenantService } from './tenant.service';

const membershipQuery = prisma.userTenant.findUnique as jest.Mock;
const userQuery = prisma.user.findUnique as jest.Mock;
const legacyUser = { role: 'owner', tenantId: 'tenant-1', isDeleted: false };

describe('membership checks during refresh', () => {
  beforeEach(() => jest.resetAllMocks());

  it('uses the current membership role instead of the user role', async () => {
    membershipQuery.mockResolvedValue({ role: 'member' });
    await expect(TenantService.assertMembership('user-1', 'tenant-1', Promise.resolve(legacyUser)))
      .resolves.toBe('member');
    expect(userQuery).not.toHaveBeenCalled();
  });

  it('starts the membership lookup before the pending user read completes', async () => {
    membershipQuery.mockResolvedValue(null);
    let resolveUser!: (user: typeof legacyUser) => void;
    const pendingUser = new Promise<typeof legacyUser>((resolve) => { resolveUser = resolve; });
    const result = TenantService.assertMembership('user-1', 'tenant-1', pendingUser);
    expect(membershipQuery).toHaveBeenCalledWith({
      where: { userId_tenantId: { userId: 'user-1', tenantId: 'tenant-1' } },
      select: { role: true },
    });
    resolveUser(legacyUser);
    await expect(result).resolves.toBe('owner');
    expect(userQuery).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { ...legacyUser, isDeleted: true },
    { ...legacyUser, tenantId: 'different-tenant' },
  ])('rejects unauthorized legacy users without another user query: %j', async (user) => {
    membershipQuery.mockResolvedValue(null);
    await expect(TenantService.assertMembership('user-1', 'tenant-1', Promise.resolve(user)))
      .rejects.toMatchObject({ status: 403, code: 'NOT_A_MEMBER' });
    expect(userQuery).not.toHaveBeenCalled();
  });

  it('preserves the database fallback for callers that do not supply a user read', async () => {
    membershipQuery.mockResolvedValue(null);
    userQuery.mockResolvedValue(legacyUser);
    await expect(TenantService.assertMembership('user-1', 'tenant-1')).resolves.toBe('owner');
    expect(userQuery).toHaveBeenCalledTimes(1);
  });
});
