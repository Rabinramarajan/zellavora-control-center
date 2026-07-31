/**
 * MenuService — load the dynamic menu tree for a user in an organization,
 * filtered by the permissions they actually have.
 *
 * The menus table stores the org's full menu tree. We:
 *   1. Load all menus for the org.
 *   2. Filter by visibility + permission set.
 *   3. Build a tree.
 */
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';
import { PermissionService } from './permission.service';

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
  /** Return the menu tree for a (user, org), filtered by what the user can see. */
  static async loadForUser(userId: string, orgId: string): Promise<MenuNode[]> {
    const perms = await PermissionService.loadForUser(userId, orgId);

    const { data, error } = await supabaseAdmin
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

    const visible = (data ?? []).filter(
      (r: Row) => !r.required_permission || PermissionService.has(perms, r.required_permission)
    ) as Row[];

    // Index by id, then build the tree.
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
