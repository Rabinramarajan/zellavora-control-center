import { Routes } from '@angular/router';
import { MessageService } from 'primeng/api';

export const timesheetRoutes: Routes = [
  {
    path: '',
    // One MessageService for the whole feature, so a toast raised by the
    // service reaches whichever p-toast is currently on screen.
    providers: [MessageService],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./components/timesheet-list/timesheet-list.component').then(
            (m) => m.TimesheetListComponent
          ),
      },
      {
        path: ':period',
        loadComponent: () =>
          import('./components/timesheet-grid/timesheet-grid.component').then(
            (m) => m.TimesheetGridComponent
          ),
      },
    ],
  },
];
