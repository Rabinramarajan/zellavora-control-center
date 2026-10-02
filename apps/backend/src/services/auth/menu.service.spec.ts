jest.mock('../../infrastructure/prisma', () => ({ prisma: {} }));
import { MenuService } from './menu.service';

describe('selected menu access', () => {
  it('shows exactly the selected Galaxy Sofas menus', async () => {
    const permissions = new Set([
      'navigation:restricted',
      'navigation:dashboard',
      'navigation:media',
      'navigation:cms-builder',
      'navigation:settings',
      'dashboard:read',
      'settings:manage',
    ]);
    const menus = await MenuService.loadForUserWithPerms('galaxy-user', 'galaxy', permissions);
    expect(menus.map((menu) => menu.key)).toEqual(['dashboard', 'content', 'system']);
    expect(menus[1].children.map((menu) => menu.key)).toEqual(['media', 'cms-builder']);
    expect(menus[2].children.map((menu) => menu.key)).toEqual(['settings']);
  });
  it('does not grant other menus that have no required permission', async () => {
    const menus = await MenuService.loadForUserWithPerms(
      'user',
      'org',
      new Set(['navigation:restricted', 'navigation:media'])
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
    const menus = await MenuService.loadForUserWithPerms('member', 'org', new Set());
    const keys = menus.map((menu) => menu.key);
    expect(keys).not.toContain('iam');
    expect(keys).not.toContain('operations');
    expect(keys).not.toContain('system');
    expect(keys).toContain('content');
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
