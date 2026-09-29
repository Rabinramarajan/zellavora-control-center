import { Routes } from '@angular/router';

export const mediaRoutes: Routes = [
  { path: '', loadComponent: () => import('./media.component').then(m => m.MediaComponent) },
];
