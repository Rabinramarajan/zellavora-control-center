import { Type } from '@angular/core';
import { CanDeactivateFn, Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guard';
import type { DailySheetFormComponent } from './pages/daily-sheet-form/daily-sheet-form.component';

const loadForm = (): Promise<Type<DailySheetFormComponent>> =>
  import('./pages/daily-sheet-form/daily-sheet-form.component').then(
    (m) => m.DailySheetFormComponent
  );

/** Ask before throwing away an unsaved sheet. */
const confirmLeaveForm: CanDeactivateFn<DailySheetFormComponent> = (form) => form.canLeave();

export const freelancerSheetsRoutes: Routes = [
  {
    path: 'daily',
    loadComponent: () =>
      import('./pages/daily-sheets/daily-sheets.component').then((m) => m.DailySheetsComponent),
  },
  // Older links pointed at /daily/list.
  { path: 'daily/list', redirectTo: 'daily', pathMatch: 'full' },
  {
    path: 'daily/new',
    loadComponent: loadForm,
    canDeactivate: [confirmLeaveForm],
    title: 'New Daily Sheet',
  },
  {
    path: 'daily/:id/edit',
    loadComponent: loadForm,
    canDeactivate: [confirmLeaveForm],
    data: { mode: 'edit' },
    title: 'Edit Daily Sheet',
  },
  {
    path: 'daily/:id',
    loadComponent: loadForm,
    data: { mode: 'view' },
    title: 'Daily Sheet',
  },
  {
    path: 'monthly',
    loadComponent: () =>
      import('./pages/monthly-sheets/monthly-sheets.component').then(
        (m) => m.MonthlySheetsComponent
      ),
  },
  { path: 'monthly/list', redirectTo: 'monthly', pathMatch: 'full' },
  {
    path: 'monthly/timesheet',
    loadComponent: () =>
      import('./pages/monthly-timesheet/monthly-timesheet.component').then(
        (m) => m.MonthlyTimesheetComponent
      ),
    title: 'Timesheet',
  },
  {
    path: 'approval',
    canActivate: [permissionGuard('timesheet:approve')],
    loadComponent: () =>
      import('./pages/approval-queue/approval-queue.component').then(
        (m) => m.ApprovalQueueComponent
      ),
  },
  { path: '', redirectTo: 'daily', pathMatch: 'full' },
];
