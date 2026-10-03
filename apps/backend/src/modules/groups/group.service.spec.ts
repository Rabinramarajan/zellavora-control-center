import { GroupService } from './group.service';
import { GroupRepository } from './group.repository';
import { CreateGroupSchema } from './group.dto';

jest.mock('../../infrastructure/audit', () => ({ AuditService: { log: jest.fn() } }));
jest.mock('../../infrastructure/cache', () => ({ cacheDelPattern: jest.fn() }));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const groupRow = (n: number, extra: Record<string, unknown> = {}) => ({
  id: id(n),
  name: `Group ${n}`,
  slug: `group-${n}`,
  description: null,
  type: 'SECURITY',
  status: 'ACTIVE',
  parentId: null,
  ownerId: null,
  isSystem: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  children: [],
  members: [],
  groupRoles: [],
  _count: { children: 0, members: 0, groupRoles: 0 },
  ...extra,
});

function makeRepo(overrides: Partial<Record<keyof GroupRepository, jest.Mock>> = {}) {
  const repo = {
    findById: jest.fn().mockResolvedValue(groupRow(1)),
    findByIdDetail: jest.fn().mockResolvedValue(groupRow(1)),
    findByName: jest.fn().mockResolvedValue(null),
    slugExists: jest.fn().mockResolvedValue(false),
    parentIdOf: jest.fn().mockResolvedValue(null),
    countUsers: jest.fn(async (ids: string[]) => ids.length),
    countRoles: jest.fn(async (ids: string[]) => ids.length),
    countBy: jest.fn(),
    create: jest.fn().mockResolvedValue(groupRow(1)),
    update: jest.fn().mockResolvedValue(groupRow(1)),
    softDelete: jest.fn(),
    addMembers: jest.fn(),
    replaceRoles: jest.fn(),
    mergeRoles: jest.fn(),
    transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        userGroup: { deleteMany: jest.fn() },
        groupRole: { deleteMany: jest.fn() },
        group: { update: jest.fn() },
      })
    ),
    ...overrides,
  };
  return repo as unknown as GroupRepository & typeof repo;
}

describe('GroupService', () => {
  it('suffixes the slug when another group already uses it', async () => {
    const repo = makeRepo({
      slugExists: jest.fn(async (slug: string) => slug === 'it-team' || slug === 'it-team-2'),
    });
    await new GroupService(repo).create(CreateGroupSchema.parse({ name: 'IT Team' }), id(99));
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'it-team-3' }),
      expect.anything()
    );
  });

  it('rejects a duplicate group name', async () => {
    const repo = makeRepo({ findByName: jest.fn().mockResolvedValue(groupRow(2)) });
    await expect(
      new GroupService(repo).create(CreateGroupSchema.parse({ name: 'Group 2' }))
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects members that do not exist', async () => {
    const repo = makeRepo({ countUsers: jest.fn().mockResolvedValue(0) });
    await expect(
      new GroupService(repo).addMembers(id(1), { userIds: [id(50)] })
    ).rejects.toMatchObject({ status: 400 });
    expect(repo.addMembers).not.toHaveBeenCalled();
  });

  it('records who added the members', async () => {
    const repo = makeRepo();
    await new GroupService(repo).addMembers(id(1), { userIds: [id(50)] }, id(99));
    expect(repo.addMembers).toHaveBeenCalledWith(id(1), [id(50)], expect.anything(), id(99));
  });

  it('rejects roles that do not exist', async () => {
    const repo = makeRepo({ countRoles: jest.fn().mockResolvedValue(0) });
    await expect(
      new GroupService(repo).setRoles(id(1), { roleIds: [id(60)], mode: 'merge' })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('refuses to move a group under its own descendant', async () => {
    // 1 → 2 → 3: making 3 the parent of 1 would create a cycle.
    const parents: Record<string, string | null> = { [id(3)]: id(2), [id(2)]: id(1) };
    const repo = makeRepo({
      findById: jest.fn(async (gid: string) => groupRow(Number(gid.slice(-2)))),
      parentIdOf: jest.fn(async (gid: string) => parents[gid] ?? null),
    });
    await expect(new GroupService(repo).update(id(1), { parentId: id(3) })).rejects.toMatchObject({
      status: 400,
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('allows an unrelated parent', async () => {
    const repo = makeRepo();
    await new GroupService(repo).update(id(1), { parentId: id(5), type: 'PROJECT' }, id(99));
    expect(repo.update).toHaveBeenCalledWith(
      id(1),
      expect.objectContaining({ parentId: id(5), type: 'PROJECT', updatedBy: id(99) })
    );
  });

  it('blocks deleting a group that still has child groups', async () => {
    const repo = makeRepo({
      findById: jest
        .fn()
        .mockResolvedValue(groupRow(1, { _count: { children: 1, members: 0, groupRoles: 0 } })),
    });
    await expect(new GroupService(repo).delete(id(1))).rejects.toMatchObject({
      status: 409,
    });
  });

  it('blocks deleting a system group', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(groupRow(1, { isSystem: true })),
    });
    await expect(new GroupService(repo).delete(id(1))).rejects.toMatchObject({
      status: 403,
    });
  });

  it('returns 404 for an unknown group', async () => {
    const repo = makeRepo({ findByIdDetail: jest.fn().mockResolvedValue(null) });
    await expect(new GroupService(repo).getById(id(1))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('summarises counts by status and type', async () => {
    const repo = makeRepo({
      countBy: jest.fn(async (field: string) =>
        field === 'status'
          ? [
              { status: 'ACTIVE', _count: { _all: 3 } },
              { status: 'INACTIVE', _count: { _all: 1 } },
            ]
          : [{ type: 'SECURITY', _count: { _all: 4 } }]
      ),
    });
    await expect(new GroupService(repo).stats()).resolves.toEqual({
      total: 4,
      byStatus: { ACTIVE: 3, INACTIVE: 1 },
      byType: { SECURITY: 4 },
    });
  });
});
