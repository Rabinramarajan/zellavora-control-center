jest.mock('../../infrastructure/prisma', () => ({ prisma: {} }));
import { MenuService, navigationPermissionDefs } from './menu.service';
import { INDIVIDUAL_PERMISSIONS } from '../../modules/auth/individual-role';

describe('selected menu access', () => {
  it('shows exactly the selected Galaxy Sofas menus', async () => {
    const permissions = new Set([
      'navigation:restricted',
      'navigation:dashboard',
      'navigation:media',
      'navigation:cms-builder',
      'navigation:settings',
      'dashboard:read',
      'media:read',
      'cms:read',
      'settings:manage',
    ]);
    const menus = await MenuService.loadForUserWithPerms('galaxy-user', 'galaxy', permissions);
    expect(menus.map((menu) => menu.key)).toEqual(['dashboard', 'content', 'system']);
    expect(menus[1].children.map((menu) => menu.key)).toEqual(['media', 'cms-builder']);
    expect(menus[2].children.map((menu) => menu.key)).toEqual(['settings']);
  });
  it('does not grant other menus the role holds when they are not selected', async () => {
    const menus = await MenuService.loadForUserWithPerms(
      'user',
      'org',
      new Set(['navigation:restricted', 'navigation:media', 'media:read', 'portfolio:read'])
    );
    expect(menus.map((menu) => menu.key)).toEqual(['content']);
    expect(menus[0].children.map((menu) => menu.key)).toEqual(['media']);
  });
  it('still requires the selected menu’s underlying permission', async () => {
    const menus = await MenuService.loadForUserWithPerms(
      'user',
      'org',
      new Set(['navigation:restricted', 'navigation:settings'])
    );
    expect(menus).toEqual([]);
  });
  it('hides a group when none of its children are permitted', async () => {
    const menus = await MenuService.loadForUserWithPerms('member', 'org', new Set(['cms:read']));
    const keys = menus.map((menu) => menu.key);
    expect(keys).not.toContain('iam');
    expect(keys).not.toContain('operations');
    expect(keys).not.toContain('system');
    expect(keys).not.toContain('portfolio');
    expect(keys).toEqual(['content']);
  });
  it('gives the Individual role its personal pages and no administration', async () => {
    const menus = await MenuService.loadForUserWithPerms(
      'individual',
      'personal',
      new Set(INDIVIDUAL_PERMISSIONS)
    );
    expect(menus.map((menu) => menu.key)).toEqual([
      'dashboard',
      'portfolio',
      'projects',
      'content',
      'appearance',
      'analytics',
      'freelancer',
      'notifications',
    ]);
    const childKeys = (key: string) =>
      menus.find((menu) => menu.key === key)?.children.map((menu) => menu.key);
    expect(childKeys('portfolio')).toHaveLength(8);
    expect(childKeys('content')).toEqual(['blog', 'media', 'cms-builder']);
    expect(childKeys('appearance')).toEqual(['theme-builder']);
    expect(childKeys('freelancer')).toEqual(['daily-sheets', 'monthly-sheets', 'timesheets']);
  });
  it('gives the owner the full grouped sidebar with a single place for user admin', async () => {
    const menus = await MenuService.loadForUserWithPerms('owner', 'org', new Set(['*:*']));
    expect(menus.map((menu) => menu.key)).toEqual([
      'dashboard',
      'portfolio',
      'projects',
      'content',
      'appearance',
      'analytics',
      'freelancer',
      'iam',
      'notifications',
      'operations',
      'system',
    ]);
    const childKeys = (key: string) =>
      menus.find((menu) => menu.key === key)?.children.map((menu) => menu.key);
    expect(childKeys('iam')).toEqual([
      'iam-users',
      'iam-user-requests',
      'iam-groups',
      'iam-roles',
      'iam-permissions',
      'iam-resources',
      'iam-organization',
      'iam-sessions',
      'iam-security',
    ]);
    expect(childKeys('operations')).toEqual(['system-health', 'audit-logs']);
    expect(childKeys('system')).toEqual([
      'settings',
      'system-configuration',
      'system-notification-management',
      'system-email',
    ]);
  });
  it('shows Sessions only with the delegated sessions:view permission', async () => {
    const iamKeys = async (perms: string[]) =>
      (await MenuService.loadForUserWithPerms('u', 'org', new Set(perms)))
        .find((menu) => menu.key === 'iam')!
        .children.map((menu) => menu.key);
    expect(await iamKeys(['users:read', 'users:manage'])).not.toContain('iam-sessions');
    expect(await iamKeys(['users:read', 'sessions:view'])).toContain('iam-sessions');
  });
});

describe('navigationPermissionDefs', () => {
  const defs = navigationPermissionDefs();
  const keys = defs.map((def) => def.key);

  it('offers a grantable permission for every menu entry, groups and children alike', () => {
    expect(keys).toContain('navigation:restricted');
    expect(keys).toContain('navigation:freelancer');
    expect(keys).toContain('navigation:timesheets');
    expect(keys).toContain('navigation:approval-queue');
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('labels entries with their place in the menu for the Roles screen', () => {
    const timesheets = defs.find((def) => def.key === 'navigation:timesheets');
    expect(timesheets?.description).toContain('Freelancer › Timesheets');
    expect(defs.every((def) => def.resource === 'navigation')).toBe(true);
  });

  it('shows a granted group with all its children', async () => {
    const menu = await MenuService.loadForUserWithPerms(
      'u',
      'o',
      new Set(['navigation:restricted', 'navigation:freelancer', 'timesheet:read', 'timesheet:approve'])
    );
    const freelancer = menu.find((node) => node.key === 'freelancer');
    expect(freelancer?.children.map((child) => child.key)).toEqual([
      'daily-sheets',
      'monthly-sheets',
      'timesheets',
      'approval-queue',
    ]);
  });
});
