jest.mock('../../infrastructure/audit', () => ({ AuditService: { log: jest.fn() } }));

import { PermissionCatalogService } from './permission-catalog.service';
import type { PermissionRepository } from './permission.repository';

const perm = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  key: 'invoices:approve',
  name: 'approve:invoices',
  resource: 'invoices',
  action: 'approve',
  description: null,
  group: null,
  createdAt: new Date(),
  _count: { rolePermissions: 0, resourceActions: 0 },
  rolePermissions: [],
  ...overrides,
});

const makeRepo = (row = perm()) =>
  ({
    findWithUsage: jest.fn(async () => row),
    findByKey: jest.fn(async () => null),
    findGroup: jest.fn(async () => ({ id: 'g1' })),
    create: jest.fn(async () => ({ id: 'p1' })),
    delete: jest.fn(),
  }) as unknown as jest.Mocked<PermissionRepository>;

describe('PermissionCatalogService', () => {
  it('builds the key as resource:action', async () => {
    const repo = makeRepo();
    await new PermissionCatalogService(repo).create(
      { resource: 'invoices', action: 'approve' },
      'actor',
      'org'
    );
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ key: 'invoices:approve' }));
  });

  it('rejects duplicate keys', async () => {
    const repo = makeRepo();
    repo.findByKey.mockResolvedValue(perm() as never);
    await expect(
      new PermissionCatalogService(repo).create(
        { resource: 'invoices', action: 'approve' },
        'actor',
        'org'
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  it('refuses to delete a permission granted by a role', async () => {
    const repo = makeRepo(perm({ _count: { rolePermissions: 2, resourceActions: 0 } }));
    await expect(
      new PermissionCatalogService(repo).remove('p1', 'actor', 'org')
    ).rejects.toMatchObject({
      code: 'PERMISSION_IN_USE',
    });
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('refuses to delete wildcard permissions', async () => {
    const repo = makeRepo(perm({ key: '*:*' }));
    await expect(
      new PermissionCatalogService(repo).remove('p1', 'actor', 'org')
    ).rejects.toMatchObject({
      code: 'PERMISSION_PROTECTED',
    });
  });

  it('deletes unused permissions', async () => {
    const repo = makeRepo();
    await new PermissionCatalogService(repo).remove('p1', 'actor', 'org');
    expect(repo.delete).toHaveBeenCalledWith('p1');
  });
});
