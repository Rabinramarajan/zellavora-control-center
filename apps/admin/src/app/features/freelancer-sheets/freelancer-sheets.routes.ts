import { Routes } from '@angular/router';

export const freelancerSheetsRoutes: Routes = [
  {
    path: 'daily',
    loadComponent: () =>
      import('./pages/daily-sheets/daily-sheets.component').then((m) => m.DailySheetsComponent),
    children: [
      { path: '', redirectTo: 'list', pathMatch: 'full' },
      { path: 'list', children: [] },
      { path: 'new', children: [] },
      { path: ':id/edit', children: [] },
      { path: ':id/view', children: [] },
    ],
  },
  {
    path: 'monthly',
    loadComponent: () =>
      import('./pages/monthly-sheets/monthly-sheets.component').then(
        (m) => m.MonthlySheetsComponent
      ),
    children: [
      { path: '', redirectTo: 'list', pathMatch: 'full' },
      { path: 'list', children: [] },
      { path: ':id/view', children: [] },
    ],
  },
  {
    path: 'approval',
    loadComponent: () =>
      import('./pages/approval-queue/approval-queue.component').then(
        (m) => m.ApprovalQueueComponent
      ),
  },
  { path: '', redirectTo: 'daily/list', pathMatch: 'full' },
];
