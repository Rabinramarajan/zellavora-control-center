import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth.guard';
import { UserListComponent } from './components/users/user-list/user-list.component';
import { UserDetailComponent } from './components/users/user-detail/user-detail.component';
import { RoleListComponent } from './components/roles/role-list/role-list.component';
import { RoleDetailComponent } from './components/roles/role-detail/role-detail.component';
import { ResourceManagerComponent } from './components/resources/resource-manager/resource-manager.component';
import { BranchManagerComponent } from './components/branches/branch-manager/branch-manager.component';

export const adminRoutes: Routes = [
  { path: '', redirectTo: 'users', pathMatch: 'full' },
  {
    path: 'users',
    component: UserListComponent,
    canActivate: [authGuard],
    data: { title: 'Users' }
  },
  {
    path: 'users/:id',
    component: UserDetailComponent,
    canActivate: [authGuard],
    data: { title: 'User Details' }
  },
  {
    path: 'roles',
    component: RoleListComponent,
    canActivate: [authGuard],
    data: { title: 'Roles' }
  },
  {
    path: 'roles/:id',
    component: RoleDetailComponent,
    canActivate: [authGuard],
    data: { title: 'Role Details' }
  },
  {
    path: 'resources',
    component: ResourceManagerComponent,
    canActivate: [authGuard],
    data: { title: 'Resources' }
  },
  {
    path: 'branches',
    component: BranchManagerComponent,
    canActivate: [authGuard],
    data: { title: 'Branches' }
  }
];
