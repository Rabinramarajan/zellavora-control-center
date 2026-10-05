import { Routes } from '@angular/router';
import { canMatchPermission, permissionGuard } from '../../core/auth/auth.guard';

export const operationsRoutes: Routes = [
  {
    path: '',
    redirectTo: 'system-health',
    pathMatch: 'full',
  },
  {
    path: 'system-health',
    canActivate: [permissionGuard('OPERATIONS_SYSTEM_HEALTH_VIEW')],
    canMatch: [canMatchPermission('OPERATIONS_SYSTEM_HEALTH_VIEW')],
    loadComponent: () =>
      import('./system-health/system-health.component').then((m) => m.SystemHealthComponent),
    data: { breadcrumb: 'System Health' },
  },
  {
    path: 'audit-logs',
    canActivate: [permissionGuard('AUDIT_LOG_VIEW')],
    canMatch: [canMatchPermission('AUDIT_LOG_VIEW')],
    loadComponent: () =>
      import('./audit-logs/audit-log-search.component').then((m) => m.AuditLogSearchComponent),
    data: { breadcrumb: 'Audit Logs' },
  },
];
