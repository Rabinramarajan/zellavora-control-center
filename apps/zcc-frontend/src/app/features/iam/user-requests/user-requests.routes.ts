import { Routes } from '@angular/router';

export const userRequestsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./user-requests.component').then((m) => m.UserRequestsComponent),
    data: { title: 'User Requests' },
  },
  {
    path: 'create',
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
    loadComponent: () =>
      import('./user-request-form.component').then((m) => m.UserRequestFormComponent),
    data: { title: 'Edit User Request' },
  },
];
