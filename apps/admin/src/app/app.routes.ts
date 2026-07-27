import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const appRoutes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'dashboard',
    // canActivate: [authGuard],
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then(
        (m) => m.dashboardRoutes
      ),
  },
  {
    path: 'portfolio',
    // canActivate: [authGuard],
    loadChildren: () =>
      import('./features/portfolio/portfolio.routes').then(
        (m) => m.portfolioRoutes
      ),
  },
  {
    path: 'projects',
    // canActivate: [authGuard],
    loadChildren: () =>
      import('./features/projects/projects.routes').then(
        (m) => m.projectsRoutes
      ),
  },
  {
    path: 'blog',
    // canActivate: [authGuard],
    loadChildren: () =>
      import('./features/blog/blog.routes').then((m) => m.blogRoutes),
  },
  {
    path: 'media',
    // canActivate: [authGuard],
    loadChildren: () =>
      import('./features/media/media.routes').then((m) => m.mediaRoutes),
  },
  {
    path: 'analytics',
    // canActivate: [authGuard],
    loadChildren: () =>
      import('./features/analytics/analytics.routes').then(
        (m) => m.analyticsRoutes
      ),
  },
  {
    path: 'users',
    // canActivate: [authGuard],
    loadChildren: () =>
      import('./features/users/users.routes').then((m) => m.usersRoutes),
  },
  {
    path: 'settings',
    // canActivate: [authGuard],
    loadChildren: () =>
      import('./features/settings/settings.routes').then(
        (m) => m.settingsRoutes
      ),
  },
  {
    path: 'admin',
    // canActivate: [authGuard],
    loadChildren: () =>
      import('./features/admin/admin.routes').then((m) => m.adminRoutes),
  },
  {
    path: 'theme-builder',
    loadComponent: () =>
      import('./features/theme-builder/theme-builder.component').then(
        (m) => m.ThemeBuilderComponent
      ),
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./features/notifications/notifications.component').then(
        (m) => m.NotificationsComponent
      ),
  },
  {
    path: 'audit-logs',
    loadComponent: () =>
      import('./features/audit-logs/audit-logs.component').then(
        (m) => m.AuditLogsComponent
      ),
  },
  {
    path: 'system-health',
    loadComponent: () =>
      import('./features/system-health/system-health.component').then(
        (m) => m.SystemHealthComponent
      ),
  },
  {
    path: 'cms-builder',
    loadComponent: () =>
      import('./features/cms-builder/cms-builder.component').then(
        (m) => m.CmsBuilderComponent
      ),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];





