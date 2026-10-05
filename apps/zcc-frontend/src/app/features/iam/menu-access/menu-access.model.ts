/** One sidebar entry as the API describes it. */
export interface MenuEntry {
  key: string;
  label: string;
  icon: string | null;
  route: string | null;
  /** Permission the entry needs besides its navigation grant. */
  requiredPermission: string | null;
  children: MenuEntry[];
}

export interface RoleMenuAccess {
  role: { id: string; name: string; isSystem: boolean };
  restricted: boolean;
  /** Granted menu keys, e.g. ["dashboard", "freelancer"]. */
  keys: string[];
  /** The role's other allowed permissions. */
  permissions: string[];
}

export interface MenuAccessDraft {
  restricted: boolean;
  keys: ReadonlySet<string>;
}

/** Same matching as the server: exact, `*:*`, `*:<action>` and `prefix:*`. */
export function hasPermission(granted: ReadonlySet<string>, code: string): boolean {
  if (granted.has(code) || granted.has('*:*')) return true;
  const segments = code.split(':');
  if (granted.has(`*:${segments.at(-1)}`)) return true;
  for (let i = 1; i < segments.length; i++) {
    if (granted.has(`${segments.slice(0, i).join(':')}:*`)) return true;
  }
  return false;
}

/**
 * The sidebar a role would get, computed exactly like the server does:
 * entries need their required permission; when restricted, an entry shows
 * only if it, or a group above it, is granted; empty groups disappear.
 */
export function visibleMenu(
  menu: readonly MenuEntry[],
  draft: MenuAccessDraft,
  permissions: ReadonlySet<string>
): MenuEntry[] {
  const visit = (entry: MenuEntry, parentSelected: boolean): MenuEntry | null => {
    if (entry.requiredPermission && !hasPermission(permissions, entry.requiredPermission)) {
      return null;
    }
    const selected = !draft.restricted || parentSelected || draft.keys.has(entry.key);
    const children = entry.children
      .map((child) => visit(child, selected))
      .filter((child): child is MenuEntry => child !== null);
    if (entry.children.length && !children.length) return null;
    if (!selected && !children.length) return null;
    return { ...entry, children };
  };
  return menu.map((entry) => visit(entry, false)).filter((e): e is MenuEntry => e !== null);
}

/** Every key in the subtree, the entry's own included. */
export function subtreeKeys(entry: MenuEntry): string[] {
  return [entry.key, ...entry.children.flatMap(subtreeKeys)];
}

/** Toggling a group grants or clears the group key and its children's keys together. */
export function toggleEntry(keys: ReadonlySet<string>, entry: MenuEntry, on: boolean): Set<string> {
  const next = new Set(keys);
  for (const key of entry.children.length ? subtreeKeys(entry) : [entry.key]) {
    if (on) next.add(key);
    else next.delete(key);
  }
  return next;
}

/** "all" when the group key is granted, "some" when only children are. */
export function groupState(keys: ReadonlySet<string>, entry: MenuEntry): 'all' | 'some' | 'none' {
  if (keys.has(entry.key)) return 'all';
  return entry.children.some((child) => groupState(keys, child) !== 'none') ? 'some' : 'none';
}

export function sameDraft(a: MenuAccessDraft, b: MenuAccessDraft): boolean {
  return (
    a.restricted === b.restricted &&
    a.keys.size === b.keys.size &&
    [...a.keys].every((k) => b.keys.has(k))
  );
}
