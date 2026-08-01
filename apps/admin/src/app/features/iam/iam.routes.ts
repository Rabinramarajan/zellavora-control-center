import { Routes } from '@angular/router';
import { authGuard, canMatchPermission } from '@core/auth/auth.guard';
import { IamLayoutComponent } from './iam-layout.component';
import { ResourcesListComponent } from './resources/resources-list.component';
import { ResourcesDetailComponent } from './resources/resources-detail.component';

export const iamRoutes: Routes = [
  {
    path: '',
    component: IamLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'resources', pathMatch: 'full' },
      {
        path: 'resources',
        canMatch: [canMatchPermission('resources:read')],
        children: [
          { path: '', component: ResourcesListComponent, data: { title: 'Resources' } },
          { path: ':id', component: ResourcesDetailComponent, data: { title: 'Resource Details' } },
        ],
      },
      {
        path: 'roles',
        canMatch: [canMatchPermission('roles:read')],
        loadChildren: () => import('./roles/roles.routes').then((m) => m.rolesRoutes),
      },
      {
        path: 'groups',
        canMatch: [canMatchPermission('groups:read')],
        loadChildren: () => import('./groups/groups.routes').then((m) => m.groupsRoutes),
      },
      {
        path: 'users',
        canMatch: [canMatchPermission('users:read')],
        loadChildren: () => import('./users/users.routes').then((m) => m.usersRoutes),
      },
    ],
  },
];
