import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';
import { ResourceManagerComponent } from './components/resources/resource-manager/resource-manager.component';
import { BranchManagerComponent } from './components/branches/branch-manager/branch-manager.component';

export const adminRoutes: Routes = [
  { path: '', redirectTo: 'users', pathMatch: 'full' },
  // Users are read-only under IAM; changes go through User Requests.
  { path: 'users', redirectTo: '/iam/users', pathMatch: 'full' },
  { path: 'users/new', redirectTo: '/iam/user-requests/create', pathMatch: 'full' },
  { path: 'users/:id', redirectTo: '/iam/users/:id' },
  { path: 'roles', redirectTo: '/iam/roles', pathMatch: 'full' },
  { path: 'roles/new', redirectTo: '/iam/roles', pathMatch: 'full' },
  { path: 'roles/:id', redirectTo: '/iam/roles/:id' },
  {
    path: 'resources',
    component: ResourceManagerComponent,
    canActivate: [authGuard],
    data: { title: 'Resources' },
  },
  {
    path: 'branches',
    component: BranchManagerComponent,
    canActivate: [authGuard],
    data: { title: 'Branches' },
  },
];
