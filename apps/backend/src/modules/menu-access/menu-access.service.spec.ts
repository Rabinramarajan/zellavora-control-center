jest.mock('../../infrastructure/prisma', () => ({ prisma: {} }));
jest.mock('../../infrastructure/audit', () => ({ AuditService: { log: jest.fn() } }));
jest.mock('../../infrastructure/cache', () => ({ cacheDelPattern: jest.fn() }));

import { MenuService } from '../../services/auth/menu.service';
import { MenuAccessService } from './menu-access.service';
import type { MenuAccessRepository } from './menu-access.repository';

const ORG = 'org-1';
const role = (overrides: Record<string, unknown> = {}) => ({
  id: 'role-1',
  name: 'Freelancer',
  key: 'org-1_freelancer',
  isSystem: false,
  organizationId: ORG,
  ...overrides,
});

describe('MenuAccessService', () => {
  let repo: jest.Mocked<MenuAccessRepository>;
  let service: MenuAccessService;
  let allowed: string[];

  beforeEach(() => {
    allowed = ['timesheet:read', 'navigation:restricted', 'navigation:dashboard'];
    repo = {
      findRole: jest.fn().mockResolvedValue(role()),
      allowedKeys: jest.fn(async () => allowed),
      permissionsByKey: jest.fn(async (keys: readonly string[]) =>
        keys.map((key) => ({ id: `id:${key}`, key }))
      ),
      replaceNavigation: jest.fn(async (_r, _o, ids: readonly string[]) => {
        allowed = [
          ...allowed.filter((key) => !key.startsWith('navigation:')),
          ...ids.map((id) => id.slice(3)),
        ];
      }),
      touchRole: jest.fn(),
      transaction: jest.fn((work) => work({} as never)),
    } as unknown as jest.Mocked<MenuAccessRepository>;
    jest.spyOn(MenuService, 'ensureNavigationPermissions').mockResolvedValue();
    service = new MenuAccessService(repo);
  });

  it('splits navigation grants from the role’s other permissions', async () => {
    expect(await service.get('role-1', ORG)).toEqual({
      role: { id: 'role-1', name: 'Freelancer', isSystem: false },
      restricted: true,
      keys: ['dashboard'],
      permissions: ['timesheet:read'],
    });
  });

  it('replaces only navigation grants', async () => {
    const view = await service.update(
      'role-1',
      { restricted: true, keys: ['freelancer', 'dashboard'] },
      ORG,
      'admin-1'
    );

    expect(repo.replaceNavigation).toHaveBeenCalledWith(
      'role-1',
      ORG,
      ['id:navigation:restricted', 'id:navigation:dashboard', 'id:navigation:freelancer'],
      expect.anything()
    );
    expect(view.keys).toEqual(['dashboard', 'freelancer']);
    expect(view.permissions).toEqual(['timesheet:read']);
  });

  it('rejects keys that are not in the menu', async () => {
    await expect(
      service.update('role-1', { restricted: true, keys: ['nope'] }, ORG, 'admin-1')
    ).rejects.toMatchObject({ status: 400, code: 'UNKNOWN_MENU_KEY' });
    expect(repo.replaceNavigation).not.toHaveBeenCalled();
  });

  it('lets a system role gain entries but not lose them', async () => {
    repo.findRole.mockResolvedValue(role({ isSystem: true }));

    await expect(
      service.update('role-1', { restricted: true, keys: [] }, ORG, 'admin-1')
    ).rejects.toMatchObject({ status: 403, code: 'SYSTEM_ROLE' });

    await expect(
      service.update('role-1', { restricted: true, keys: ['dashboard', 'media'] }, ORG, 'admin-1')
    ).resolves.toMatchObject({ keys: ['dashboard', 'media'] });
  });

  it('hides another organization’s role', async () => {
    repo.findRole.mockResolvedValue(role({ organizationId: 'org-2' }));
    await expect(service.get('role-1', ORG)).rejects.toMatchObject({ status: 404 });
  });

  it('serves the menu tree with groups and sub-menus', () => {
    const freelancer = service.tree().find((node) => node.key === 'freelancer');
    expect(freelancer?.children.map((child) => child.key)).toContain('approval-queue');
    expect(
      service
        .tree()
        .find((n) => n.key === 'iam')
        ?.children.map((c) => c.key)
    ).toContain('iam-menu-access');
  });
});
