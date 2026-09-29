import { Routes } from '@angular/router';
import { UsersDetailComponent } from './users-detail.component';

export const usersRoutes: Routes = [
  { path: '', loadComponent: () => import('../../users/users.component').then((m) => m.UsersComponent), data: { title: 'Users' } },
  { path: 'new', redirectTo: '', pathMatch: 'full' },
  { path: ':id', component: UsersDetailComponent, data: { title: 'User Details' } },
];
