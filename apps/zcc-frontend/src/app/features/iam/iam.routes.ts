import { Route, Routes } from '@angular/router';
import { authGuard, canMatchPermission } from '@core/auth/auth.guard';
import { IamLayoutComponent } from './iam-layout.component';
import { ResourcesListComponent } from './resources/resources-list.component';
import { ResourcesDetailComponent } from './resources/resources-detail.component';

const section = (path: string, title: string, icon: string, description: string): Route => ({
  path,
  loadComponent: () => import('./iam-section.component').then((m) => m.IamSectionComponent),
  data: { title, icon, description },
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
      section('user-requests', 'User Requests', 'pi pi-inbox', 'Review and approve access and sign-up requests.'),
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
      section('permissions', 'Permissions', 'pi pi-lock', 'System permissions available for role assignment.'),
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
        children: [
          { path: '', redirectTo: 'branches', pathMatch: 'full' },
          {
            path: 'branches',
            loadComponent: () =>
              import('../admin/components/branches/branch-manager/branch-manager.component').then(
                (m) => m.BranchManagerComponent,
              ),
            data: { title: 'Branches' },
          },
          section('departments', 'Departments', 'pi pi-briefcase', 'Departments within your organization.'),
          section('teams', 'Teams', 'pi pi-sitemap', 'Teams and their members.'),
        ],
      },
      section('sessions', 'Sessions', 'pi pi-desktop', 'Active user sessions and devices.'),
      {
        path: 'security',
        children: [
          { path: '', redirectTo: 'mfa', pathMatch: 'full' },
          section('mfa', 'MFA / 2FA', 'pi pi-mobile', 'Multi-factor authentication requirements.'),
          section('password-policy', 'Password Policy', 'pi pi-key', 'Password strength, rotation and reuse rules.'),
          section('login-policy', 'Login Policy', 'pi pi-sign-in', 'Lockout, IP and sign-in restrictions.'),
        ],
      },
      section('configuration', 'Common Configuration', 'pi pi-cog', 'Shared identity settings and defaults.'),
      section('messages', 'Messages', 'pi pi-comments', 'In-app messages sent to users.'),
      section('email', 'Email Communication', 'pi pi-envelope', 'Email templates and delivery for identity events.'),
      {
        path: 'audit-logs',
        loadComponent: () =>
          import('../audit-logs/audit-logs.component').then((m) => m.AuditLogsComponent),
        data: { title: 'Audit Logs' },
      },
    ],
  },
];
