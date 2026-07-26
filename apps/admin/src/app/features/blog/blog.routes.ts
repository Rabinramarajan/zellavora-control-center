import { Routes } from '@angular/router';

export const blogRoutes: Routes = [
  { path: '', loadComponent: () => import('./blog.component').then(m => m.BlogComponent) },
];
