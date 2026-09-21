import type { Express } from 'express';
import authRoutes from './auth';
import registerRoutes from './register';
import projectRoutes from './projects';
import portfolioRoutes from './portfolio';
import galleryRoutes from './gallery';
import techRoutes from './technologies';
import adminUsersRoutes from './admin-users';
import adminGroupsRoutes from './admin-groups';
import adminRolesRoutes from './admin-roles';
import adminResourcesRoutes from './admin-resources';
import adminConfigsRoutes from './admin-configs';
import adminAuditRoutes from './admin-audit';
import adminMessagesRoutes from './admin-messages';
import settingsRoutes from './settings';
import identityAuthRoutes from '../modules/auth/auth.routes';
import invitationRoutes from '../modules/invitation/invitation.routes';
import organizationRoutes from '../modules/organization/organization.routes';
import branchRoutes from '../modules/branch/branch.routes';
import permissionRoutes from '../modules/permission/permission.routes';
import organizationSettingsRoutes from '../modules/settings/settings.routes';
import notificationRoutes from '../modules/notification/notification.routes';
import verificationRoutes from '../modules/verification/verification.routes';
import auditLogRoutes from '../modules/audit/audit.routes';
import storageRoutes from '../modules/storage/storage.routes';
import lookupRoutes from '../modules/ddl/ddl.routes';
import emailRoutes from './email.routes';
import { registrationRoutes } from '../modules/registration';
import dashboardRoutes from '../modules/dashboard/dashboard.routes';
import resourceRoutes from '../modules/resources/resource.routes';
import roleRoutes from '../modules/roles/role.routes';
import groupRoutes from '../modules/groups/group.routes';
import iamUserRoutes from '../modules/users/iam-user.routes';
import dailySheetsRoutes from '../modules/daily-sheets/daily-sheets.routes';
import monthlySheetsRoutes from '../modules/monthly-sheets/monthly-sheets.routes';
import timesheetsRoutes from '../modules/timesheets/timesheets.routes';

/** Register canonical API namespaces first, retaining historical paths as compatibility aliases. */
export function registerApiRoutes(app: Express): void {
  // Core routes
  app.use('/api/v1/auth', authRoutes);
  app.use(['/api/v1/auth/registrations', '/api/v1/auth/register'], registerRoutes);

  // New Enterprise Registration routes
  app.use(['/api/v1/registrations', '/api/v1/register'], registrationRoutes);

  // Organization and identity services
  app.use(['/api/v1/identity/auth', '/api/v1/clean/auth'], identityAuthRoutes);
  app.use(['/api/v1/invitations', '/api/v1/clean/invitations'], invitationRoutes);
  app.use(['/api/v1/organizations', '/api/v1/clean/organizations'], organizationRoutes);
  app.use(['/api/v1/branches', '/api/v1/clean/branches'], branchRoutes);
  app.use(['/api/v1/permissions', '/api/v1/clean/permissions'], permissionRoutes);
  app.use(['/api/v1/organization-settings', '/api/v1/clean/settings'], organizationSettingsRoutes);
  app.use(['/api/v1/notifications', '/api/v1/clean/notifications'], notificationRoutes);
  app.use(['/api/v1/verifications', '/api/v1/clean/verifications'], verificationRoutes);
  app.use(['/api/v1/audit-logs', '/api/v1/clean/audits'], auditLogRoutes);
  app.use(['/api/v1/storage', '/api/v1/clean/storage'], storageRoutes);
  app.use(['/api/v1/lookups', '/api/v1/clean/ddls'], lookupRoutes);

  // Operations Dashboard (tenant-scoped)
  app.use('/api/v1/dashboard', dashboardRoutes);

  // IAM Admin Console — RBAC modules (Resources first; Roles, Groups, Users follow)
  app.use('/api/v1/iam/resources', resourceRoutes);
  app.use('/api/v1/iam/roles', roleRoutes);
  app.use('/api/v1/iam/groups', groupRoutes);
  app.use('/api/v1/iam/users', iamUserRoutes);
  // Mounted under /projects: this router declares bare '/' and '/:id' paths, which at
  // the /api/v1 root would swallow every other top-level route (daily-sheets, etc).
  app.use('/api/v1/projects', projectRoutes);
  app.use('/api/v1', portfolioRoutes);
  app.use('/api/v1', galleryRoutes);
  app.use('/api/v1', techRoutes);
  app.use('/api/v1', settingsRoutes);

  // Timesheet management routes
  app.use('/api/v1/daily-sheets', dailySheetsRoutes);
  app.use('/api/v1/monthly-sheets', monthlySheetsRoutes);
  app.use('/api/v1/timesheets', timesheetsRoutes);

  app.use('/api/v1/admin', adminUsersRoutes);
  app.use('/api/v1/admin', adminGroupsRoutes);
  app.use('/api/v1/admin', adminRolesRoutes);
  app.use('/api/v1/admin', adminResourcesRoutes);
  app.use('/api/v1/admin', adminConfigsRoutes);
  app.use('/api/v1/admin', adminAuditRoutes);
  app.use('/api/v1/admin', adminMessagesRoutes);

  // Email service routes
  app.use('/api/v1/email', emailRoutes);
}
