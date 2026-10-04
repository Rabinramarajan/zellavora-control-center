import { Routes } from '@angular/router';

/** Legacy /admin URLs; every screen now lives under IAM. */
export const adminRoutes: Routes = [
  { path: '', redirectTo: '/iam/users', pathMatch: 'full' },
  // Users are read-only under IAM; changes go through User Requests.
  { path: 'users', redirectTo: '/iam/users', pathMatch: 'full' },
  { path: 'users/new', redirectTo: '/iam/user-requests/create', pathMatch: 'full' },
  { path: 'users/:id', redirectTo: '/iam/users/:id' },
  { path: 'roles', redirectTo: '/iam/roles', pathMatch: 'full' },
  { path: 'roles/new', redirectTo: '/iam/roles', pathMatch: 'full' },
  { path: 'roles/:id', redirectTo: '/iam/roles/:id' },
  { path: 'resources', redirectTo: '/iam/resources', pathMatch: 'full' },
  { path: 'branches', redirectTo: '/iam/organization/branches', pathMatch: 'full' },
];
