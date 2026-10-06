import { Router, type Router as ExpressRouter } from 'express';
import { adminAuthGuard } from './middleware/admin-auth';

// Operations & System Health
import operationsHealthRoutes from '../operations/health/health.routes';
import auditLogRoutes from '../audit/audit.routes';
import dashboardRoutes from '../dashboard/dashboard.routes';
import analyticsRoutes from '../analytics/analytics.routes';

// IAM Admin Console
import resourceRoutes from '../resources/resource.routes';
import roleRoutes from '../roles/role.routes';
import menuAccessRoutes from '../menu-access/menu-access.routes';
import groupRoutes from '../groups/group.routes';
import iamUserRoutes from '../users/iam-user.routes';
import userRequestRoutes from '../user-requests/user-request.routes';
import iamPermissionRoutes from '../permission/permission-catalog.routes';
import iamDepartmentRoutes from '../departments/departments.routes';
import iamTeamRoutes from '../teams/teams.routes';
import iamSessionRoutes from '../sessions/sessions.routes';
import iamSecurityRoutes from '../security-policy/security-policy.routes';
import iamConfigurationRoutes from '../configuration/configuration.routes';
import iamCommunicationRoutes from '../communications/communications.routes';

// Tenant & Organization Administration
import invitationRoutes from '../invitation/invitation.routes';
import organizationRoutes from '../organization/organization.routes';
import branchRoutes from '../branch/branch.routes';
import permissionRoutes from '../permission/permission.routes';
import organizationSettingsRoutes from '../settings/settings.routes';
import emailSettingsRoutes from '../email-settings/email-settings.routes';
import registrationSettingsRoutes from '../registration-settings/registration-settings.routes';
import approvalModeRoutes from '../approval-mode/approval-mode.routes';
import invoicesRoutes from '../invoices/invoices.routes';

// CMS & Storage & Lookups
import cmsRoutes from '../cms/cms.routes';
import storageRoutes from '../storage/storage.routes';
import lookupRoutes from '../ddl/ddl.routes';

const router: ExpressRouter = Router();

// Enforce admin authentication across all admin submodules
router.use(adminAuthGuard);

// Mount all Admin API sub-routes
// Operations
router.use('/operations/health', operationsHealthRoutes);
router.use('/operations/audit-logs', auditLogRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/analytics', analyticsRoutes);

// IAM Admin
router.use('/iam/resources', resourceRoutes);
router.use('/iam/roles', roleRoutes);
router.use('/iam/menu-access', menuAccessRoutes);
router.use('/iam/groups', groupRoutes);
router.use('/iam/users', iamUserRoutes);
router.use('/iam/user-requests', userRequestRoutes);
router.use('/iam/permissions', iamPermissionRoutes);
router.use('/iam/departments', iamDepartmentRoutes);
router.use('/iam/teams', iamTeamRoutes);
router.use('/iam/sessions', iamSessionRoutes);
router.use('/iam/security', iamSecurityRoutes);
router.use('/iam/configurations', iamConfigurationRoutes);
router.use('/iam/communications', iamCommunicationRoutes);

// Organization Administration
router.use('/invitations', invitationRoutes);
router.use('/organizations', organizationRoutes);
router.use('/branches', branchRoutes);
router.use('/permissions', permissionRoutes);
router.use('/organization-settings', organizationSettingsRoutes);
router.use('/settings/email', emailSettingsRoutes);
router.use('/settings/registration', registrationSettingsRoutes);
router.use('/approval-mode', approvalModeRoutes);
router.use('/invoices', invoicesRoutes);

// CMS, Storage & Lookups
router.use('/cms', cmsRoutes);
router.use('/storage', storageRoutes);
router.use('/lookups', lookupRoutes);

export default router;
