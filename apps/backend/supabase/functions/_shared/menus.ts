import { getSupabaseAdmin } from './db.ts';
import { AppError } from './errors.ts';
import { PermissionService } from './auth.ts';

export interface MenuNode {
  id: string;
  key: string;
  label: string;
  icon: string | null;
  route: string | null;
  orderIndex: number;
  children: MenuNode[];
}

export class MenuService {
  static async loadForUser(userId: string, orgId: string): Promise<MenuNode[]> {
    const perms = await PermissionService.loadForUser(userId, orgId);
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from('menus')
      .select('*')
      .eq('organization_id', orgId)
      .eq('visible', true)
      .order('order_index', { ascending: true });

    if (error) throw new AppError('Failed to load menus', 500, 'MENU_LOAD_FAILED');

    type Row = {
      id: string;
      parent_id: string | null;
      key: string;
      label: string;
      icon: string | null;
      route: string | null;
      required_permission: string | null;
      order_index: number;
    };

    const visible = (data ?? []).filter((r: Row) =>
      !r.required_permission || PermissionService.has(perms, r.required_permission)
    ) as Row[];

    const byId = new Map<string, MenuNode>();
    visible.forEach((r) =>
      byId.set(r.id, {
        id: r.id,
        key: r.key,
        label: r.label,
        icon: r.icon,
        route: r.route,
        orderIndex: r.order_index,
        children: [],
      })
    );
    const roots: MenuNode[] = [];
    visible.forEach((r) => {
      const node = byId.get(r.id)!;
      if (r.parent_id && byId.has(r.parent_id)) {
        byId.get(r.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }
}
