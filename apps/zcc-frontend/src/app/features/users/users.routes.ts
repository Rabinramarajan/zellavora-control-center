import { Routes } from '@angular/router';

export const usersRoutes: Routes = [
  { path: '', loadComponent: () => import('./users.component').then(m => m.UsersComponent) },
];
