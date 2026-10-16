jest.mock('../../infrastructure/audit', () => ({ AuditService: { log: jest.fn() } }));
jest.mock('../../infrastructure/cache', () => ({ cacheDelPattern: jest.fn() }));

import { IamUserRepository, inOrganization } from './iam-user.repository';
import { IamUserService } from './iam-user.service';
import type { UserAdminRepository } from './user-admin.repository';
import { UserAdminService } from './user-admin.service';
import { IamUserListQuerySchema } from './iam-user.dto';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const MEMBERS_OF_A = { userTenants: { some: { tenantId: ORG_A } } };

const fakeDb = () => ({
  user: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findFirst: jest.fn().mockResolvedValue(null),
  },
  branch: { findMany: jest.fn().mockResolvedValue([]) },
});

const repoWith = (db: ReturnType<typeof fakeDb>) => {
  const repo = new IamUserRepository();
  jest.spyOn(repo as unknown as { getDb: () => unknown }, 'getDb').mockReturnValue(db);
  return repo;
};

describe('IAM user directory is scoped to the caller organization', () => {
  it('builds the membership filter from the organization id', () => {
    expect(inOrganization(ORG_A)).toEqual(MEMBERS_OF_A);
  });

  it('list filters every query by membership of the token organization', async () => {
    const db = fakeDb();
    const service = new IamUserService(repoWith(db));
    await service.list(ORG_A, IamUserListQuerySchema.parse({}));

    const findWhere = db.user.findMany.mock.calls[0][0].where;
    const countWhere = db.user.count.mock.calls[0][0].where;
    expect(findWhere.AND).toContainEqual(MEMBERS_OF_A);
    expect(countWhere.AND).toContainEqual(MEMBERS_OF_A);
  });

  it('list cannot be widened by a search term or a user id filter', async () => {
    const db = fakeDb();
    const service = new IamUserService(repoWith(db));
    await service.list(ORG_A, IamUserListQuerySchema.parse({ q: USER, userId: USER }));
    expect(db.user.findMany.mock.calls[0][0].where.AND).toContainEqual(MEMBERS_OF_A);
  });

  it('stats counts only members of the organization', async () => {
    const db = fakeDb();
    const service = new IamUserService(repoWith(db));
    await service.stats(ORG_A);

    expect(db.user.count.mock.calls.length).toBeGreaterThan(1);
    for (const [args] of db.user.count.mock.calls) {
      const serialized = JSON.stringify(args.where);
      expect(serialized).toContain(ORG_A);
    }
  });

  it('getById answers 404 for a user who belongs to another organization', async () => {
    const db = fakeDb();
    db.user.findFirst.mockResolvedValue(null); // the membership filter excludes them
    const service = new IamUserService(repoWith(db));

    await expect(service.getById(USER, ORG_B)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(db.user.findFirst.mock.calls[0][0].where).toMatchObject({
      id: USER,
      userTenants: { some: { tenantId: ORG_B } },
    });
  });

  it('lock refuses to touch a user outside the organization', async () => {
    const db = fakeDb();
    const repo = repoWith(db);
    const transaction = jest.spyOn(repo, 'transaction');
    const service = new IamUserService(repo);

    await expect(service.lock(USER, ORG_A, { reason: 'x' }, 'actor')).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(db.user.findFirst.mock.calls[0][0].where).toMatchObject(MEMBERS_OF_A);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('lock treats a malformed id as a missing user', async () => {
    const service = new IamUserService(repoWith(fakeDb()));
    await expect(service.lock('not-a-uuid', ORG_A, {}, 'actor')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('user detail sections are scoped to the caller organization', () => {
  it('findUser filters by membership', () => {
    const db = { user: { findFirst: jest.fn().mockResolvedValue(null) } };
    const repo = new (jest.requireActual('./user-admin.repository').UserAdminRepository)();
    jest.spyOn(repo as unknown as { getDb: () => unknown }, 'getDb').mockReturnValue(db);
    void repo.findUser(USER, ORG_A);
    expect(db.user.findFirst.mock.calls[0][0].where).toMatchObject(MEMBERS_OF_A);
  });

  it.each([
    ['profile', (s: UserAdminService) => s.profile(USER, actor())],
    ['access', (s: UserAdminService) => s.access(USER, ORG_A)],
    ['sessions', (s: UserAdminService) => s.sessions(USER, actor())],
    ['notes', (s: UserAdminService) => s.notes(USER, ORG_A)],
    ['status history', (s: UserAdminService) => s.statusHistory(USER, ORG_A)],
    ['emails', (s: UserAdminService) => s.emailHistory(USER, ORG_A)],
    ['audit', (s: UserAdminService) => s.audit(USER, ORG_A)],
    ['requests', (s: UserAdminService) => s.requestHistory(USER, ORG_A)],
  ])('%s answers 404 for a user in another organization', async (_name, call) => {
    const repo = { findUser: jest.fn().mockResolvedValue(null) } as unknown as UserAdminRepository;
    const service = new UserAdminService(repo);
    await expect(call(service)).rejects.toMatchObject({ status: 404, code: 'USER_NOT_FOUND' });
    expect(repo.findUser).toHaveBeenCalledWith(USER, ORG_A);
  });
});

function actor() {
  return { userId: 'actor', organizationId: ORG_A, canManage: true, canRequest: true };
}
