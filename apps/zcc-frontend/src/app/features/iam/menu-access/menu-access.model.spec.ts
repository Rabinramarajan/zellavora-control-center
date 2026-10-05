import {
  MenuEntry,
  groupState,
  hasPermission,
  sameDraft,
  toggleEntry,
  visibleMenu,
} from './menu-access.model';

const entry = (
  key: string,
  children: MenuEntry[] = [],
  requiredPermission: string | null = null
): MenuEntry => ({
  key,
  label: key,
  icon: null,
  route: children.length ? null : `/${key}`,
  requiredPermission,
  children,
});

const menu: MenuEntry[] = [
  entry('dashboard', [], 'dashboard:read'),
  entry('freelancer', [
    entry('timesheets', [], 'timesheet:read'),
    entry('approval-queue', [], 'timesheet:approve'),
  ]),
];

const keysOf = (entries: MenuEntry[]): string[] =>
  entries.flatMap((e) => [e.key, ...keysOf(e.children)]);

describe('menu access model', () => {
  it('matches permissions with the same wildcards as the server', () => {
    expect(hasPermission(new Set(['timesheet:read']), 'timesheet:read')).toBeTrue();
    expect(hasPermission(new Set(['timesheet:*']), 'timesheet:approve')).toBeTrue();
    expect(hasPermission(new Set(['*:approve']), 'timesheet:approve')).toBeTrue();
    expect(hasPermission(new Set(['*:*']), 'anything:here')).toBeTrue();
    expect(hasPermission(new Set(['timesheet:read']), 'timesheet:approve')).toBeFalse();
  });

  it('shows everything usable when the sidebar is not restricted', () => {
    const shown = visibleMenu(
      menu,
      { restricted: false, keys: new Set() },
      new Set(['dashboard:read', 'timesheet:read'])
    );
    expect(keysOf(shown)).toEqual(['dashboard', 'freelancer', 'timesheets']);
  });

  it('shows a granted group with every child the role can use', () => {
    const shown = visibleMenu(
      menu,
      { restricted: true, keys: new Set(['freelancer']) },
      new Set(['timesheet:read', 'timesheet:approve'])
    );
    expect(keysOf(shown)).toEqual(['freelancer', 'timesheets', 'approval-queue']);
  });

  it('keeps a ticked entry hidden while its permission is missing, and drops empty groups', () => {
    const shown = visibleMenu(
      menu,
      { restricted: true, keys: new Set(['approval-queue']) },
      new Set(['timesheet:read'])
    );
    expect(shown).toEqual([]);
  });

  it('toggles a group together with its children', () => {
    const on = toggleEntry(new Set(), menu[1], true);
    expect([...on].sort()).toEqual(['approval-queue', 'freelancer', 'timesheets']);
    expect(groupState(on, menu[1])).toBe('all');

    const off = toggleEntry(on, menu[1], false);
    expect(off.size).toBe(0);

    const partly = toggleEntry(new Set(), menu[1].children[0], true);
    expect(groupState(partly, menu[1])).toBe('some');
  });

  it('compares drafts by value', () => {
    expect(
      sameDraft(
        { restricted: true, keys: new Set(['a', 'b']) },
        { restricted: true, keys: new Set(['b', 'a']) }
      )
    ).toBeTrue();
    expect(
      sameDraft(
        { restricted: true, keys: new Set(['a']) },
        { restricted: false, keys: new Set(['a']) }
      )
    ).toBeFalse();
  });
});
