jest.mock('../../infrastructure/audit', () => ({ AuditService: { log: jest.fn() } }));

import { DepartmentsService } from './departments.service';
import type { DepartmentsRepository } from './departments.repository';

const ORG = 'org';
const dept = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Dept ${id}`,
  code: null,
  description: null,
  status: 'active',
  parentId: null,
  parent: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { userTenants: 0, children: 0 },
  ...overrides,
});

const makeRepo = () =>
  ({
    findById: jest.fn(async (id: string) => dept(id)),
    findByName: jest.fn(async () => null),
    parentMap: jest.fn(async () => [
      { id: 'root', parentId: null },
      { id: 'child', parentId: 'root' },
      { id: 'grandchild', parentId: 'child' },
    ]),
    update: jest.fn(),
    softDelete: jest.fn(),
    listMembers: jest.fn(async () => []),
    create: jest.fn(async () => dept('new')),
  }) as unknown as jest.Mocked<DepartmentsRepository>;

describe('DepartmentsService', () => {
  it('refuses to move a department under its own descendant', async () => {
    const repo = makeRepo();
    await expect(
      new DepartmentsService(repo).update(ORG, 'root', { parentId: 'grandchild' }, 'actor')
    ).rejects.toMatchObject({ status: 400, code: 'DEPARTMENT_CYCLE' });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('allows moving under an unrelated department', async () => {
    const repo = makeRepo();
    await new DepartmentsService(repo).update(ORG, 'grandchild', { parentId: 'root' }, 'actor');
    expect(repo.update).toHaveBeenCalledWith(
      'grandchild',
      expect.objectContaining({ parentId: 'root' })
    );
  });

  it('refuses to delete a department that still has sub-departments', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(
      dept('root', { _count: { userTenants: 2, children: 1 } }) as never
    );
    await expect(new DepartmentsService(repo).remove(ORG, 'root', 'actor')).rejects.toMatchObject({
      status: 409,
      code: 'DEPARTMENT_HAS_CHILDREN',
    });
    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  it('rejects duplicate names on create', async () => {
    const repo = makeRepo();
    repo.findByName.mockResolvedValue(dept('existing') as never);
    await expect(
      new DepartmentsService(repo).create(ORG, { name: 'Engineering', status: 'active' }, 'actor')
    ).rejects.toMatchObject({ status: 409, code: 'DEPARTMENT_EXISTS' });
  });

  it('returns 404 for a department outside the organization', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(null as never);
    await expect(new DepartmentsService(repo).get(ORG, 'missing')).rejects.toMatchObject({
      status: 404,
    });
  });
});
