import { Routes } from '@angular/router';
import { UsersListComponent } from './users-list.component';
import { UsersDetailComponent } from './users-detail.component';

export const usersRoutes: Routes = [
  { path: '', component: UsersListComponent, data: { title: 'Users' } },
  { path: 'new', redirectTo: '', pathMatch: 'full' },
  { path: ':id', component: UsersDetailComponent, data: { title: 'User Details' } },
];
