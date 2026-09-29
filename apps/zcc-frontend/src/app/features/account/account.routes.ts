import { Routes } from '@angular/router';

/** Account area (authenticated; guarded where mounted in app.routes). Not part of the main sidebar. */
export const accountRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'security' },
  {
    path: 'security',
    title: 'Security · ZCC',
    loadComponent: () => import('./pages/security/security.page').then((m) => m.SecurityPage),
  },
  {
    path: 'change-password',
    title: 'Change password · ZCC',
    loadComponent: () =>
      import('./pages/change-password/change-password.page').then((m) => m.ChangePasswordPage),
  },
];
