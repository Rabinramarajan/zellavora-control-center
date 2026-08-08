/**
 * MenuService — load the dynamic menu tree for a user in an organization,
 * filtered by the permissions they actually have.
 *
 * In the Supabase deployment the menu is stored in a `menus` table. That table
 * does not exist in the Prisma (local/Postgres-only) deployment, so we serve a
 * sensible static menu tree and filter it by the user's permissions via
 * PermissionService.has().
 */
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

interface MenuDef {
  id: string;
  key: string;
  label: string;
  icon: string | null;
  route: string | null;
  orderIndex: number;
  requiredPermission?: string;
  children?: MenuDef[];
}

const DEFAULT_MENU: MenuDef[] = [
  {
    id: 'dashboard',
    key: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    route: '/dashboard',
    orderIndex: 1,
  },
  {
    id: 'freelancer-sheets',
    key: 'freelancer-sheets',
    label: 'Freelancer Sheets',
    icon: '📋',
    route: '/freelancer-sheets',
    orderIndex: 2,
    children: [
      { id: 'daily-sheets', key: 'daily-sheets', label: 'Daily Sheets', icon: '📅', route: '/freelancer-sheets/daily', orderIndex: 1 },
      { id: 'monthly-sheets', key: 'monthly-sheets', label: 'Monthly Sheets', icon: '📊', route: '/freelancer-sheets/monthly', orderIndex: 2 },
      { id: 'approval-queue', key: 'approval-queue', label: 'Approval Queue', icon: '✓', route: '/freelancer-sheets/approval', orderIndex: 3 },
    ],
  },
  {
    id: 'admin',
    key: 'admin',
    label: 'Admin',
    icon: '🛡️',
    route: '/admin',
    orderIndex: 3,
    requiredPermission: 'users:manage',
    children: [
      { id: 'admin-users', key: 'admin-users', label: 'Users', icon: '👥', route: '/admin/users', orderIndex: 1, requiredPermission: 'users:manage' },
      { id: 'admin-roles', key: 'admin-roles', label: 'Roles & Permissions', icon: '🔐', route: '/admin/roles', orderIndex: 2, requiredPermission: 'users:manage' },
      { id: 'admin-audit', key: 'admin-audit', label: 'Audit Logs', icon: '🧾', route: '/admin/audit', orderIndex: 3 },
    ],
  },
];

const toNode = (d: MenuDef): MenuNode => ({
  id: d.id,
  key: d.key,
  label: d.label,
  icon: d.icon,
  route: d.route,
  orderIndex: d.orderIndex,
  children: [],
});

export class MenuService {
  /** Return the menu tree for a (user, org), filtered by what the user can see. */
  static async loadForUser(userId: string, orgId: string): Promise<MenuNode[]> {
    return this.loadForUserWithPerms(userId, orgId, await PermissionService.loadForUser(userId, orgId));
  }

  /** Load menu tree with pre-loaded permissions (optimization for /auth/me). */
  static async loadForUserWithPerms(userId: string, orgId: string, perms: Set<string>): Promise<MenuNode[]> {
    const visible = (node: MenuDef): MenuNode | null => {
      if (node.requiredPermission && !PermissionService.has(perms, node.requiredPermission)) {
        return null;
      }
      const children = (node.children ?? [])
        .map(visible)
        .filter((n): n is MenuNode => n !== null);
      return {
        ...toNode(node),
        children,
      };
    };

    return DEFAULT_MENU.map(visible).filter((n): n is MenuNode => n !== null);
  }
}