import { Routes } from '@angular/router';

export const settingsRoutes: Routes = [
  { path: '', redirectTo: 'general', pathMatch: 'full' },
  {
    path: ':tab',
    loadComponent: () => import('./settings.component').then((m) => m.SettingsComponent),
    // The tab segment names itself, e.g. /settings/profile reads as "Profile".
  },
];
