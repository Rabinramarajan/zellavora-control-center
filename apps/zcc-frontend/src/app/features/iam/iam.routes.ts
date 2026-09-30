import { Route, Routes } from '@angular/router';
import { authGuard, canMatchPermission } from '@core/auth/auth.guard';
import { IamLayoutComponent } from './iam-layout.component';
import { ResourcesListComponent } from './resources/resources-list.component';
import { ResourcesDetailComponent } from './resources/resources-detail.component';

const securityPolicy = (
  path: string,
  section: 'password' | 'login' | 'mfa',
  title: string
): Route => ({
  path,
  loadComponent: () =>
    import('./security/security-policy.component').then((m) => m.SecurityPolicyComponent),
  data: { title, section },
});

const communications = (path: string, channel: 'in_app' | 'email', title: string): Route => ({
  path,
  canMatch: [canMatchPermission('settings:manage')],
  loadComponent: () =>
    import('./communications/communications.component').then((m) => m.CommunicationsComponent),
  data: { title, channel },
});

export const iamRoutes: Routes = [
  {
    path: '',
    component: IamLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'users', pathMatch: 'full' },
      {
        path: 'users',
        canMatch: [canMatchPermission('users:read')],
        loadChildren: () => import('./users/users.routes').then((m) => m.usersRoutes),
      },
      {
        path: 'user-requests',
        canMatch: [canMatchPermission('users:read')],
        loadChildren: () =>
          import('./user-requests/user-requests.routes').then((m) => m.userRequestsRoutes),
      },
      {
        path: 'groups',
        canMatch: [canMatchPermission('groups:read')],
        loadChildren: () => import('./groups/groups.routes').then((m) => m.groupsRoutes),
      },
      {
        path: 'roles',
        canMatch: [canMatchPermission('roles:read')],
        loadChildren: () => import('./roles/roles.routes').then((m) => m.rolesRoutes),
      },
      {
        path: 'permissions',
        canMatch: [canMatchPermission('roles:read')],
        loadComponent: () =>
          import('./permissions/permissions.component').then((m) => m.PermissionsComponent),
        data: { title: 'Permissions' },
      },
      {
        path: 'resources',
        canMatch: [canMatchPermission('resources:read')],
        children: [
          { path: '', component: ResourcesListComponent, data: { title: 'Resources' } },
          { path: ':id', component: ResourcesDetailComponent, data: { title: 'Resource Details' } },
        ],
      },
      {
        path: 'organization',
        canMatch: [canMatchPermission('users:read')],
        children: [
          { path: '', redirectTo: 'branches', pathMatch: 'full' },
          {
            path: 'branches',
            loadComponent: () =>
              import('../admin/components/branches/branch-manager/branch-manager.component').then(
                (m) => m.BranchManagerComponent
              ),
            data: { title: 'Branches' },
          },
          {
            path: 'departments',
            loadComponent: () =>
              import('./organization/departments-list.component').then(
                (m) => m.DepartmentsListComponent
              ),
            data: { title: 'Departments' },
          },
          {
            path: 'departments/:id',
            loadComponent: () =>
              import('./organization/department-detail.component').then(
                (m) => m.DepartmentDetailComponent
              ),
            data: { title: 'Department' },
          },
          {
            path: 'teams',
            loadComponent: () =>
              import('./organization/teams-list.component').then((m) => m.TeamsListComponent),
            data: { title: 'Teams' },
          },
          {
            path: 'teams/:id',
            loadComponent: () =>
              import('./organization/team-detail.component').then((m) => m.TeamDetailComponent),
            data: { title: 'Team' },
          },
        ],
      },
      {
        path: 'sessions',
        canMatch: [canMatchPermission('users:manage')],
        loadComponent: () =>
          import('./sessions/sessions.component').then((m) => m.SessionsComponent),
        data: { title: 'Sessions' },
      },
      {
        path: 'security',
        canMatch: [canMatchPermission('settings:manage')],
        children: [
          { path: '', redirectTo: 'mfa', pathMatch: 'full' },
          securityPolicy('mfa', 'mfa', 'MFA / 2FA'),
          securityPolicy('password-policy', 'password', 'Password Policy'),
          securityPolicy('login-policy', 'login', 'Login Policy'),
        ],
      },
      {
        path: 'configuration',
        canMatch: [canMatchPermission('settings:manage')],
        loadComponent: () =>
          import('./configuration/configuration.component').then((m) => m.ConfigurationComponent),
        data: { title: 'Common Configuration' },
      },
      communications('messages', 'in_app', 'Messages'),
      communications('email', 'email', 'Email Communication'),
      {
        path: 'audit-logs',
        loadComponent: () =>
          import('../audit-logs/audit-logs.component').then((m) => m.AuditLogsComponent),
        data: { title: 'Audit Logs' },
      },
    ],
  },
];
