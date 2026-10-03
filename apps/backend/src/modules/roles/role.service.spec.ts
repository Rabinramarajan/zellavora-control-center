import { RoleService } from './role.service';
import { RoleRepository } from './role.repository';
import { CreateRoleSchema } from './role.dto';

jest.mock('../../infrastructure/audit', () => ({ AuditService: { log: jest.fn() } }));
jest.mock('../../infrastructure/cache', () => ({ cacheDelPattern: jest.fn() }));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ORG = id(900);

const roleRow = (n: number, extra: Record<string, unknown> = {}) => ({
  id: id(n),
  name: `Role ${n}`,
  key: `role_${n}`,
  organizationId: null,
  description: null,
  scope: 'ORG',
  status: 'ACTIVE',
  isSystem: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  rolePermissions: [],
  groupRoles: [],
  userAssignments: [],
  _count: { userAssignments: 0, rolePermissions: 0, groupRoles: 0 },
  ...extra,
});

function makeRepo(overrides: Partial<Record<keyof RoleRepository, jest.Mock>> = {}) {
  const repo = {
    findById: jest.fn().mockResolvedValue(roleRow(1)),
    findByIdWithPermissions: jest.fn().mockResolvedValue(roleRow(1)),
    findByKey: jest.fn().mockResolvedValue(null),
    findByName: jest.fn().mockResolvedValue(null),
    countBy: jest.fn(),
    countPermissions: jest.fn(async (ids: string[]) => ids.length),
    create: jest.fn().mockResolvedValue(roleRow(1)),
    update: jest.fn().mockResolvedValue(roleRow(1)),
    softDelete: jest.fn(),
    listPermissions: jest.fn().mockResolvedValue([]),
    replacePermissions: jest.fn(),
    upsertPermissions: jest.fn(),
    copyPermissions: jest.fn(),
    transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        role: { update: jest.fn() },
        rolePermission: { deleteMany: jest.fn() },
        userRoleAssignment: { deleteMany: jest.fn() },
        groupRole: { deleteMany: jest.fn() },
      })
    ),
    ...overrides,
  };
  return repo as unknown as RoleRepository & typeof repo;
}

const allow = (n: number) => ({ permissionId: id(n), effect: 'allow' as const });

describe('RoleService', () => {
  it('suffixes the key when another role already uses it', async () => {
    const repo = makeRepo({
      findByKey: jest.fn(async (key: string) => (key === 'hr_admin' ? roleRow(2) : null)),
    });
    await new RoleService(repo).create(CreateRoleSchema.parse({ name: 'HR Admin' }), id(99), ORG);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'hr_admin_2', organizationId: ORG })
    );
  });

  it('never creates system roles through the API', async () => {
    const repo = makeRepo();
    await new RoleService(repo).create(CreateRoleSchema.parse({ name: 'Root', isSystem: true }));
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ isSystem: false }));
  });

  it('rejects a duplicate role name', async () => {
    const repo = makeRepo({ findByName: jest.fn().mockResolvedValue(roleRow(2)) });
    await expect(
      new RoleService(repo).create(CreateRoleSchema.parse({ name: 'Role 2' }))
    ).rejects.toMatchObject({ status: 409 });
  });

  it('allows keeping the same name when updating', async () => {
    const repo = makeRepo({ findByName: jest.fn().mockResolvedValue(roleRow(1)) });
    await new RoleService(repo).update(id(1), { name: 'Role 1', scope: 'GLOBAL' });
    expect(repo.update).toHaveBeenCalledWith(
      id(1),
      expect.objectContaining({ name: 'Role 1', scope: 'GLOBAL' })
    );
  });

  it('refuses to change the scope of a system role', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(roleRow(1, { isSystem: true })),
    });
    await expect(new RoleService(repo).update(id(1), { scope: 'GLOBAL' })).rejects.toMatchObject({
      status: 403,
    });
  });

  it('scopes permissions of a platform role to the caller organization', async () => {
    const repo = makeRepo();
    await new RoleService(repo).setPermissions(
      id(1),
      { permissions: [allow(10)], mode: 'replace' },
      id(99),
      ORG
    );
    expect(repo.replacePermissions).toHaveBeenCalledWith(
      id(1),
      ORG,
      [allow(10)],
      expect.anything()
    );
  });

  it('fails cleanly when no organization is available for permissions', async () => {
    const repo = makeRepo();
    await expect(
      new RoleService(repo).setPermissions(id(1), { permissions: [allow(10)], mode: 'replace' })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects unknown permissions', async () => {
    const repo = makeRepo({ countPermissions: jest.fn().mockResolvedValue(0) });
    await expect(
      new RoleService(repo).setPermissions(
        id(1),
        { permissions: [allow(10)], mode: 'replace' },
        id(99),
        ORG
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(repo.replacePermissions).not.toHaveBeenCalled();
  });

  it('only merges permissions into system roles', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(roleRow(1, { isSystem: true })),
    });
    await expect(
      new RoleService(repo).setPermissions(id(1), { permissions: [], mode: 'replace' }, id(99), ORG)
    ).rejects.toMatchObject({ status: 403 });
  });

  it('blocks deleting a system role', async () => {
    const repo = makeRepo({
      findById: jest.fn().mockResolvedValue(roleRow(1, { isSystem: true })),
    });
    await expect(new RoleService(repo).delete(id(1))).rejects.toMatchObject({ status: 403 });
  });

  it('lists each user once in the detail even with several assignments', async () => {
    const user = {
      id: id(50),
      fullName: 'Ada',
      email: 'ada@x.io',
      employeeCode: null,
      status: 'ACTIVE',
    };
    const repo = makeRepo({
      findByIdWithPermissions: jest.fn().mockResolvedValue(
        roleRow(1, {
          userAssignments: [
            { createdAt: new Date('2026-02-01'), user },
            { createdAt: new Date('2026-03-01'), user },
          ],
        })
      ),
    });
    const detail = await new RoleService(repo).getById(id(1));
    expect(detail.users).toHaveLength(1);
  });

  it('summarises counts by status and scope', async () => {
    const repo = makeRepo({
      countBy: jest.fn(async (field: string) =>
        field === 'status'
          ? [{ status: 'ACTIVE', _count: { _all: 2 } }]
          : [{ scope: 'ORG', _count: { _all: 2 } }]
      ),
    });
    await expect(new RoleService(repo).stats()).resolves.toEqual({
      total: 2,
      byStatus: { ACTIVE: 2 },
      byScope: { ORG: 2 },
    });
  });
});
