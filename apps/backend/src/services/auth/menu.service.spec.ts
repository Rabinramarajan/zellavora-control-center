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
    expect(menus.map((menu) => menu.key)).toEqual([
      'dashboard',
      'media',
      'cms-builder',
      'settings',
    ]);
  });
  it('does not grant other menus that have no required permission', async () => {
    const menus = await MenuService.loadForUserWithPerms(
      'user',
      'org',
      new Set(['navigation:restricted', 'navigation:media'])
    );
    expect(menus.map((menu) => menu.key)).toEqual(['media']);
  });
  it('still requires the selected menu’s underlying permission', async () => {
    const menus = await MenuService.loadForUserWithPerms(
      'user',
      'org',
      new Set(['navigation:restricted', 'navigation:settings'])
    );
    expect(menus).toEqual([]);
  });
  it('preserves the existing owner menu', async () => {
    const menus = await MenuService.loadForUserWithPerms('owner', 'org', new Set(['*:*']));
    expect(menus.some((menu) => menu.key === 'admin')).toBe(true);
    expect(menus.some((menu) => menu.key === 'portfolio')).toBe(true);
    expect(menus.length).toBeGreaterThan(4);
  });
});
