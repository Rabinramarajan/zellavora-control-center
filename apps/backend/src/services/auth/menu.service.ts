/**
 * MenuService — load the dynamic menu tree for a user in an organization,
 * filtered by the permissions they actually have.
 *
 * In the Supabase deployment the menu is stored in a `menus` table. That table
 * does not exist in the Prisma (local/Postgres-only) deployment, so we serve a
 * sensible static menu tree and filter it by the user's permissions via
 * PermissionService.has().
 */
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
    requiredPermission: 'dashboard:read',
  },
  {
    id: 'portfolio',
    key: 'portfolio',
    label: 'Portfolio',
    icon: '🎨',
    route: '/portfolio',
    orderIndex: 2,
    children: [
      {
        id: 'portfolio-profile',
        key: 'portfolio-profile',
        label: 'Profile',
        icon: '👤',
        route: '/portfolio/profile',
        orderIndex: 1,
      },
      {
        id: 'portfolio-hero',
        key: 'portfolio-hero',
        label: 'Hero',
        icon: '🌟',
        route: '/portfolio/hero',
        orderIndex: 2,
      },
      {
        id: 'portfolio-about',
        key: 'portfolio-about',
        label: 'About',
        icon: '📝',
        route: '/portfolio/about',
        orderIndex: 3,
      },
      {
        id: 'portfolio-skills',
        key: 'portfolio-skills',
        label: 'Skills',
        icon: '🧠',
        route: '/portfolio/skills',
        orderIndex: 4,
      },
      {
        id: 'portfolio-experience',
        key: 'portfolio-experience',
        label: 'Experience',
        icon: '💼',
        route: '/portfolio/experience',
        orderIndex: 5,
      },
      {
        id: 'portfolio-education',
        key: 'portfolio-education',
        label: 'Education',
        icon: '🎓',
        route: '/portfolio/education',
        orderIndex: 6,
      },
      {
        id: 'portfolio-services',
        key: 'portfolio-services',
        label: 'Services',
        icon: '🛠️',
        route: '/portfolio/services',
        orderIndex: 7,
      },
      {
        id: 'portfolio-testimonials',
        key: 'portfolio-testimonials',
        label: 'Testimonials',
        icon: '💬',
        route: '/portfolio/testimonials',
        orderIndex: 8,
      },
    ],
  },
  {
    id: 'projects',
    key: 'projects',
    label: 'Projects',
    icon: '🗂️',
    route: '/projects',
    orderIndex: 3,
  },
  {
    id: 'content',
    key: 'content',
    label: 'Content',
    icon: '📝',
    route: null,
    orderIndex: 4,
    children: [
      {
        id: 'blog',
        key: 'blog',
        label: 'Blog / Insights',
        icon: '✍️',
        route: '/blog',
        orderIndex: 1,
      },
      {
        id: 'media',
        key: 'media',
        label: 'Media Library',
        icon: '🖼️',
        route: '/media',
        orderIndex: 2,
      },
      {
        id: 'cms-builder',
        key: 'cms-builder',
        label: 'CMS Builder',
        icon: '🧱',
        route: '/cms-builder',
        orderIndex: 3,
      },
    ],
  },
  {
    id: 'appearance',
    key: 'appearance',
    label: 'Appearance',
    icon: '🖌️',
    route: null,
    orderIndex: 5,
    children: [
      {
        id: 'theme-builder',
        key: 'theme-builder',
        label: 'Theme Builder',
        icon: '🎛️',
        route: '/theme-builder',
        orderIndex: 1,
      },
    ],
  },
  {
    id: 'analytics',
    key: 'analytics',
    label: 'Analytics',
    icon: '📈',
    route: '/analytics',
    orderIndex: 6,
  },
  {
    id: 'freelancer',
    key: 'freelancer',
    label: 'Freelancer',
    icon: '💼',
    route: null,
    orderIndex: 7,
    children: [
      {
        id: 'daily-sheets',
        key: 'daily-sheets',
        label: 'Daily Sheets',
        icon: '📅',
        route: '/freelancer-sheets/daily',
        orderIndex: 1,
      },
      {
        id: 'monthly-sheets',
        key: 'monthly-sheets',
        label: 'Monthly Sheets',
        icon: '📊',
        route: '/freelancer-sheets/monthly',
        orderIndex: 2,
      },
      {
        id: 'timesheets',
        key: 'timesheets',
        label: 'Timesheets',
        icon: '⏱️',
        route: '/timesheets',
        orderIndex: 3,
      },
      {
        id: 'approval-queue',
        key: 'approval-queue',
        label: 'Approval Queue',
        icon: '✓',
        route: '/freelancer-sheets/approval',
        orderIndex: 4,
        requiredPermission: 'timesheet:approve',
      },
    ],
  },
  {
    id: 'iam',
    key: 'iam',
    label: 'Identity & Access',
    icon: '👥',
    route: null,
    orderIndex: 8,
    children: [
      {
        id: 'iam-users',
        key: 'iam-users',
        label: 'Users',
        icon: '🙍',
        route: '/iam/users',
        orderIndex: 1,
        requiredPermission: 'users:read',
      },
      {
        id: 'iam-roles',
        key: 'iam-roles',
        label: 'Roles',
        icon: '👑',
        route: '/iam/roles',
        orderIndex: 2,
        requiredPermission: 'roles:read',
      },
      {
        id: 'iam-permissions',
        key: 'iam-permissions',
        label: 'Permissions',
        icon: '🔐',
        route: '/admin/roles',
        orderIndex: 3,
        requiredPermission: 'roles:manage',
      },
      {
        id: 'iam-groups',
        key: 'iam-groups',
        label: 'Groups',
        icon: '🧑‍🤝‍🧑',
        route: '/iam/groups',
        orderIndex: 4,
        requiredPermission: 'groups:read',
      },
      {
        id: 'iam-resources',
        key: 'iam-resources',
        label: 'Resources',
        icon: '🧩',
        route: '/iam/resources',
        orderIndex: 5,
        requiredPermission: 'resources:read',
      },
    ],
  },
  {
    id: 'organization',
    key: 'organization',
    label: 'Organization',
    icon: '🏢',
    route: null,
    orderIndex: 9,
    children: [
      {
        id: 'org-branches',
        key: 'org-branches',
        label: 'Branches',
        icon: '🏬',
        route: '/admin/branches',
        orderIndex: 1,
        requiredPermission: 'users:manage',
      },
    ],
  },
  {
    id: 'notifications',
    key: 'notifications',
    label: 'Notifications',
    icon: '🔔',
    route: '/notifications',
    orderIndex: 10,
  },
  {
    id: 'operations',
    key: 'operations',
    label: 'Operations',
    icon: '🛡️',
    route: null,
    orderIndex: 11,
    children: [
      {
        id: 'audit-logs',
        key: 'audit-logs',
        label: 'Audit Logs',
        icon: '🧾',
        route: '/audit-logs',
        orderIndex: 1,
        requiredPermission: 'system:audit:read',
      },
      {
        id: 'system-health',
        key: 'system-health',
        label: 'System Health',
        icon: '🩺',
        route: '/system-health',
        orderIndex: 2,
        requiredPermission: 'system:rbac:read',
      },
    ],
  },
  {
    id: 'system',
    key: 'system',
    label: 'System',
    icon: '⚙️',
    route: null,
    orderIndex: 12,
    children: [
      {
        id: 'settings',
        key: 'settings',
        label: 'General Settings',
        icon: '🛠️',
        route: '/settings',
        orderIndex: 1,
        requiredPermission: 'settings:manage',
      },
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
    return this.loadForUserWithPerms(
      userId,
      orgId,
      await PermissionService.loadForUser(userId, orgId)
    );
  }

  /** Load menu tree with pre-loaded permissions (optimization for /auth/me). */
  static async loadForUserWithPerms(
    userId: string,
    orgId: string,
    perms: Set<string>
  ): Promise<MenuNode[]> {
    const restricted = perms.has('navigation:restricted');
    const visible = (node: MenuDef, parentSelected = false): MenuNode | null => {
      if (node.requiredPermission && !PermissionService.has(perms, node.requiredPermission)) {
        return null;
      }
      const selected = !restricted || parentSelected || perms.has(`navigation:${node.key}`);
      const children = (node.children ?? [])
        .map((child) => visible(child, selected))
        .filter((n): n is MenuNode => n !== null);
      // A group whose children are all hidden would render as a dead link.
      if (node.children?.length && !children.length) return null;
      if (!selected && !children.length) return null;
      return {
        ...toNode(node),
        children,
      };
    };

    return DEFAULT_MENU.map((node) => visible(node)).filter((n): n is MenuNode => n !== null);
  }
}
