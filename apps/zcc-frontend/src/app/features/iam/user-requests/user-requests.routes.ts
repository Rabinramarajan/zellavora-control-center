import { Routes } from '@angular/router';
import { canMatchPermission } from '../../../core/auth/auth.guard';

export const userRequestsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./user-requests.component').then((m) => m.UserRequestsComponent),
    data: { title: 'User Requests' },
  },
  {
    path: 'create',
    canMatch: [canMatchPermission('user-requests:create')],
    loadComponent: () =>
      import('./user-request-form.component').then((m) => m.UserRequestFormComponent),
    data: { title: 'New User Request' },
  },
  {
    path: ':requestId',
    loadComponent: () =>
      import('./user-request-detail.component').then((m) => m.UserRequestDetailComponent),
    data: { title: 'User Request Details' },
  },
  {
    path: ':requestId/edit',
    canMatch: [canMatchPermission('user-requests:update')],
    loadComponent: () =>
      import('./user-request-form.component').then((m) => m.UserRequestFormComponent),
    data: { title: 'Edit User Request' },
  },
];
