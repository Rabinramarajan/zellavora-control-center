import { Route, Routes } from '@angular/router';
import { canMatchPermission } from '../../core/auth/auth.guard';
import { IamLayoutComponent } from '../iam/iam-layout.component';

const communications = (path: string, channel: 'in_app' | 'email', title: string): Route => ({
  path,
  loadComponent: () =>
    import('../iam/communications/communications.component').then(
      (m) => m.CommunicationsComponent
    ),
  data: { title, channel },
});

export const systemRoutes: Routes = [
  {
    path: '',
    component: IamLayoutComponent,
    canMatch: [canMatchPermission('settings:manage')],
    children: [
      { path: '', redirectTo: 'configuration', pathMatch: 'full' },
      {
        path: 'configuration',
        loadComponent: () =>
          import('../iam/configuration/configuration.component').then(
            (m) => m.ConfigurationComponent
          ),
        data: { title: 'Common Configuration' },
      },
      communications('notification-management', 'in_app', 'Notification Management'),
      communications('email', 'email', 'Email Communication'),
    ],
  },
];
