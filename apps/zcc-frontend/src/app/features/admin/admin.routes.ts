import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';
import { RoleListComponent } from './components/roles/role-list/role-list.component';
import { RoleDetailComponent } from './components/roles/role-detail/role-detail.component';
import { ResourceManagerComponent } from './components/resources/resource-manager/resource-manager.component';
import { BranchManagerComponent } from './components/branches/branch-manager/branch-manager.component';

export const adminRoutes: Routes = [
  { path: '', redirectTo: 'users', pathMatch: 'full' },
  // Users are read-only under IAM; changes go through User Requests.
  { path: 'users', redirectTo: '/iam/users', pathMatch: 'full' },
  { path: 'users/new', redirectTo: '/iam/user-requests/create', pathMatch: 'full' },
  { path: 'users/:id', redirectTo: '/iam/users/:id' },
  {
    path: 'roles',
    component: RoleListComponent,
    canActivate: [authGuard],
    data: { title: 'Roles' },
  },
  {
    path: 'roles/:id',
    component: RoleDetailComponent,
    canActivate: [authGuard],
    data: { title: 'Role Details' },
  },
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
