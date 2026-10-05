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
import { prisma } from '../../infrastructure/prisma';
import { logger } from '../../infrastructure/logger';

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
  /** Shown only while someone in the workspace signs off sheets. */
  requiresReviewQueue?: boolean;
  children?: MenuDef[];
}

export interface MenuOptions {
  /** False when sheets finalize on submit, so there is nothing to review. */
  reviewQueue: boolean;
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
    requiredPermission: 'portfolio:read',
    orderIndex: 2,
    children: [
      {
        id: 'portfolio-profile',
        key: 'portfolio-profile',
        label: 'Profile',
        icon: '👤',
        route: '/portfolio/profile',
        requiredPermission: 'portfolio:read',
        orderIndex: 1,
      },
      {
        id: 'portfolio-hero',
        key: 'portfolio-hero',
        label: 'Hero',
        icon: '🌟',
        route: '/portfolio/hero',
        requiredPermission: 'portfolio:read',
        orderIndex: 2,
      },
      {
        id: 'portfolio-about',
        key: 'portfolio-about',
        label: 'About',
        icon: '📝',
        route: '/portfolio/about',
        requiredPermission: 'portfolio:read',
        orderIndex: 3,
      },
      {
        id: 'portfolio-skills',
        key: 'portfolio-skills',
        label: 'Skills',
        icon: '🧠',
        route: '/portfolio/skills',
        requiredPermission: 'portfolio:read',
        orderIndex: 4,
      },
      {
        id: 'portfolio-experience',
        key: 'portfolio-experience',
        label: 'Experience',
        icon: '💼',
        route: '/portfolio/experience',
        requiredPermission: 'portfolio:read',
        orderIndex: 5,
      },
      {
        id: 'portfolio-education',
        key: 'portfolio-education',
        label: 'Education',
        icon: '🎓',
        route: '/portfolio/education',
        requiredPermission: 'portfolio:read',
        orderIndex: 6,
      },
      {
        id: 'portfolio-services',
        key: 'portfolio-services',
        label: 'Services',
        icon: '🛠️',
        route: '/portfolio/services',
        requiredPermission: 'portfolio:read',
        orderIndex: 7,
      },
      {
        id: 'portfolio-testimonials',
        key: 'portfolio-testimonials',
        label: 'Testimonials',
        icon: '💬',
        route: '/portfolio/testimonials',
        requiredPermission: 'portfolio:read',
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
    requiredPermission: 'projects:read',
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
        requiredPermission: 'blog:read',
        orderIndex: 1,
      },
      {
        id: 'media',
        key: 'media',
        label: 'Media Library',
        icon: '🖼️',
        route: '/media',
        requiredPermission: 'media:read',
        orderIndex: 2,
      },
      {
        id: 'cms-builder',
        key: 'cms-builder',
        label: 'CMS Builder',
        icon: '🧱',
        route: '/cms-builder',
        requiredPermission: 'cms:read',
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
        requiredPermission: 'themes:read',
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
    requiredPermission: 'analytics:read',
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
        requiredPermission: 'timesheet:read',
        orderIndex: 1,
      },
      {
        id: 'monthly-sheets',
        key: 'monthly-sheets',
        label: 'Monthly Sheets',
        icon: '📊',
        route: '/freelancer-sheets/monthly',
        requiredPermission: 'timesheet:read',
        orderIndex: 2,
      },
      {
        id: 'timesheets',
        key: 'timesheets',
        label: 'Timesheets',
        icon: '⏱️',
        route: '/timesheets',
        requiredPermission: 'timesheet:read',
        orderIndex: 3,
      },
      {
        id: 'approval-queue',
        key: 'approval-queue',
        label: 'Approval Queue',
        icon: '✅',
        route: '/freelancer-sheets/approval',
        orderIndex: 4,
        requiredPermission: 'timesheet:approve',
        requiresReviewQueue: true,
      },
      {
        id: 'invoices',
        key: 'invoices',
        label: 'Invoices',
        icon: '🧾',
        route: '/invoices',
        requiredPermission: 'timesheet:read',
        orderIndex: 5,
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
        icon: '👤',
        route: '/iam/users',
        orderIndex: 1,
        requiredPermission: 'users:read',
      },
      {
        id: 'iam-user-requests',
        key: 'iam-user-requests',
        label: 'User Requests',
        icon: '📨',
        route: '/iam/user-requests',
        orderIndex: 2,
        requiredPermission: 'user-requests:read',
      },
      {
        id: 'iam-groups',
        key: 'iam-groups',
        label: 'Groups',
        icon: '👥',
        route: '/iam/groups',
        orderIndex: 3,
        requiredPermission: 'groups:read',
      },
      {
        id: 'iam-roles',
        key: 'iam-roles',
        label: 'Roles',
        icon: '👑',
        route: '/iam/roles',
        orderIndex: 4,
        requiredPermission: 'roles:read',
      },
      {
        id: 'iam-menu-access',
        key: 'iam-menu-access',
        label: 'Menu Access',
        icon: '🧭',
        route: '/iam/menu-access',
        // Sits right after Roles without renumbering the entries below.
        orderIndex: 4.5,
        requiredPermission: 'roles:read',
      },
      {
        id: 'iam-permissions',
        key: 'iam-permissions',
        label: 'Permissions',
        icon: '🔐',
        route: '/iam/permissions',
        orderIndex: 5,
        requiredPermission: 'roles:read',
      },
      {
        id: 'iam-resources',
        key: 'iam-resources',
        label: 'Resources',
        icon: '🧩',
        route: '/iam/resources',
        orderIndex: 6,
        requiredPermission: 'resources:read',
      },
      {
        id: 'iam-organization',
        key: 'iam-organization',
        label: 'Organization',
        icon: '🏢',
        route: null,
        orderIndex: 7,
        children: [
          {
            id: 'iam-org-branches',
            key: 'iam-org-branches',
            label: 'Branches',
            icon: '🏬',
            route: '/iam/organization/branches',
            orderIndex: 1,
            requiredPermission: 'users:manage',
          },
          {
            id: 'iam-org-departments',
            key: 'iam-org-departments',
            label: 'Departments',
            icon: '🗃️',
            route: '/iam/organization/departments',
            orderIndex: 2,
            requiredPermission: 'users:manage',
          },
          {
            id: 'iam-org-teams',
            key: 'iam-org-teams',
            label: 'Teams',
            icon: '🤝',
            route: '/iam/organization/teams',
            orderIndex: 3,
            requiredPermission: 'users:manage',
          },
        ],
      },
      {
        id: 'iam-sessions',
        key: 'iam-sessions',
        label: 'Sessions',
        icon: '🔒',
        route: '/iam/sessions',
        orderIndex: 8,
        // Owner (`*:*`) sees everyone; delegated holders see only their people.
        requiredPermission: 'sessions:view',
      },
      {
        id: 'iam-security',
        key: 'iam-security',
        label: 'Security',
        icon: '🛡️',
        route: null,
        orderIndex: 9,
        children: [
          {
            id: 'iam-security-mfa',
            key: 'iam-security-mfa',
            label: 'MFA / 2FA',
            icon: '📱',
            route: '/iam/security/mfa',
            orderIndex: 1,
            requiredPermission: 'settings:manage',
          },
          {
            id: 'iam-security-password',
            key: 'iam-security-password',
            label: 'Password Policy',
            icon: '🔑',
            route: '/iam/security/password-policy',
            orderIndex: 2,
            requiredPermission: 'settings:manage',
          },
          {
            id: 'iam-security-login',
            key: 'iam-security-login',
            label: 'Login Policy',
            icon: '🚪',
            route: '/iam/security/login-policy',
            orderIndex: 3,
            requiredPermission: 'settings:manage',
          },
        ],
      },
    ],
  },
  {
    id: 'notifications',
    key: 'notifications',
    label: 'Notifications',
    icon: '🔔',
    route: '/notifications',
    requiredPermission: 'notifications:read',
    orderIndex: 9,
  },
  {
    id: 'operations',
    key: 'operations',
    label: 'Operations',
    icon: '🛡️',
    route: null,
    orderIndex: 10,
    children: [
      {
        id: 'system-health',
        key: 'system-health',
        label: 'System Health',
        icon: '🩺',
        route: '/operations/system-health',
        orderIndex: 1,
        requiredPermission: 'system:rbac:read',
      },
      {
        id: 'audit-logs',
        key: 'audit-logs',
        label: 'Audit Logs',
        icon: '🧾',
        route: '/operations/audit-logs',
        orderIndex: 2,
        requiredPermission: 'system:audit:read',
      },
    ],
  },
  {
    id: 'system',
    key: 'system',
    label: 'System',
    icon: '⚙️',
    route: null,
    orderIndex: 11,
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
      {
        id: 'system-configuration',
        key: 'system-configuration',
        label: 'Common Configuration',
        icon: '⚙️',
        route: '/system/configuration',
        orderIndex: 2,
        requiredPermission: 'settings:manage',
      },
      {
        id: 'system-notification-management',
        key: 'system-notification-management',
        label: 'Notification Management',
        icon: '💬',
        route: '/system/notification-management',
        orderIndex: 3,
        requiredPermission: 'settings:manage',
      },
      {
        id: 'system-email',
        key: 'system-email',
        label: 'Email Communication',
        icon: '✉️',
        route: '/system/email',
        orderIndex: 4,
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

/** One menu entry as the Menu Access screen shows it. */
export interface MenuDefinitionNode {
  key: string;
  label: string;
  icon: string | null;
  route: string | null;
  /** Permission the entry needs besides its navigation grant. */
  requiredPermission: string | null;
  children: MenuDefinitionNode[];
}

/** The full menu, unfiltered, in display order. */
export function menuDefinition(menu: readonly MenuDef[] = DEFAULT_MENU): MenuDefinitionNode[] {
  return [...menu]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((node) => ({
      key: node.key,
      label: node.label,
      icon: node.icon,
      route: node.route,
      requiredPermission: node.requiredPermission ?? null,
      children: menuDefinition(node.children ?? []),
    }));
}

export interface NavigationPermissionDef {
  name: string;
  key: string;
  resource: 'navigation';
  action: string;
  description: string;
}

/**
 * The navigation permissions the menu understands, derived from the menu
 * itself so every entry can be granted from the Roles screen and a new menu
 * item needs no migration or seed.
 */
export function navigationPermissionDefs(
  menu: readonly MenuDef[] = DEFAULT_MENU
): NavigationPermissionDef[] {
  const defs: NavigationPermissionDef[] = [
    {
      name: 'navigation:restricted',
      key: 'navigation:restricted',
      resource: 'navigation',
      action: 'restricted',
      description:
        'Limit the sidebar to menu entries granted with navigation:<entry> permissions. Without it, every entry the role can use is shown.',
    },
  ];
  const walk = (nodes: readonly MenuDef[], trail: string[]) => {
    for (const node of nodes) {
      const path = [...trail, node.label];
      const group = node.children?.length ? ' and everything under it' : '';
      defs.push({
        name: `navigation:${node.key}`,
        key: `navigation:${node.key}`,
        resource: 'navigation',
        action: node.key,
        description: `Show "${path.join(' › ')}"${group} in the sidebar (applies with navigation:restricted).`,
      });
      if (node.children) walk(node.children, path);
    }
  };
  walk(menu, []);
  return defs;
}

let navigationSync: Promise<void> | null = null;

export class MenuService {
  /**
   * Make sure every navigation permission exists in the catalog. Runs once
   * per process; existing rows, and any edits to them, are left untouched.
   */
  static ensureNavigationPermissions(): Promise<void> {
    navigationSync ??= prisma.permission
      .createMany({ data: navigationPermissionDefs(), skipDuplicates: true })
      .then(() => undefined)
      .catch((error: unknown) => {
        // Retry on the next request rather than caching the failure.
        navigationSync = null;
        logger.error('Navigation permission sync failed', error);
      });
    return navigationSync;
  }

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
    perms: Set<string>,
    options: MenuOptions = { reviewQueue: true }
  ): Promise<MenuNode[]> {
    const restricted = perms.has('navigation:restricted');
    const visible = (node: MenuDef, parentSelected = false): MenuNode | null => {
      if (node.requiredPermission && !PermissionService.has(perms, node.requiredPermission)) {
        return null;
      }
      if (node.requiresReviewQueue && !options.reviewQueue) return null;
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
