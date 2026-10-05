/** One step of the breadcrumb trail. `url` is null for the current page, which is never a link. */
export interface BreadcrumbItem {
  readonly label: string;
  readonly url: string | null;
}

/** Shape a route may put on `data.breadcrumb` when the label needs more than a string. */
export interface BreadcrumbRouteConfig {
  readonly label: string;
  /** false renders the crumb as plain text, for paths that have no screen of their own. */
  readonly link?: boolean;
}

export type BreadcrumbRouteData = string | BreadcrumbRouteConfig;

/**
 * Labels for URL segments that carry no route `data` of their own — feature roots mounted
 * with `loadChildren` and intermediate segments of a multi-segment path. Routes that declare
 * `data.breadcrumb` or `data.title` win over this map.
 */
export const BREADCRUMB_SEGMENT_LABELS: Readonly<Record<string, string>> = {
  account: 'Account',
  admin: 'Admin Console',
  analytics: 'Analytics',
  approval: 'Approval Queue',
  'audit-logs': 'Audit Logs',
  blog: 'Blog',
  branches: 'Branches',
  clients: 'Clients',
  cms: 'CMS',
  'cms-builder': 'CMS Builder',
  communications: 'Communications',
  configuration: 'Common Configuration',
  daily: 'Daily Sheets',
  dashboard: 'Dashboard',
  departments: 'Departments',
  edit: 'Edit',
  email: 'Email Communication',
  'freelancer-sheets': 'Freelancer Sheets',
  groups: 'Groups',
  iam: 'Identity & Access',
  import: 'Import',
  invoices: 'Invoices',
  'login-policy': 'Login Policy',
  media: 'Media',
  'menu-access': 'Menu Access',
  mfa: 'MFA / 2FA',
  monthly: 'Monthly Sheets',
  new: 'New',
  notifications: 'Notifications',
  'notification-management': 'Notification Management',
  operations: 'Operations',
  organization: 'Organization',
  'password-policy': 'Password Policy',
  permissions: 'Permissions',
  portfolio: 'Portfolio',
  projects: 'Projects',
  resources: 'Resources',
  roles: 'Roles',
  security: 'Security',
  services: 'Services',
  sessions: 'Sessions',
  settings: 'Settings',
  skills: 'Skills',
  system: 'System',
  'system-health': 'System Health',
  teams: 'Teams',
  testimonials: 'Testimonials',
  'theme-builder': 'Theme Builder',
  timesheet: 'Timesheet',
  timesheets: 'Timesheets',
  'user-requests': 'User Requests',
  users: 'Users',
};
