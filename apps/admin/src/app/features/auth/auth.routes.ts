import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '../../core/auth/auth.guard';

export const authRoutes: Routes = [
  {
    path: 'login',
    // canActivate: [guestGuard],
    loadComponent: () =>
      import('./components/login/login.component').then(
        (m) => m.LoginComponent
      ),
  },
  {
    path: 'register',
    // canActivate: [guestGuard],
    loadComponent: () =>
      import('./components/register/register.component').then(
        (m) => m.RegisterComponent
      ),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./components/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./components/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      ),
  },
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./components/verify-email/verify-email.component').then(
        (m) => m.VerifyEmailComponent
      ),
  },
  {
    path: 'mfa-verify',
    loadComponent: () =>
      import('./components/mfa-verify/mfa-verify.component').then(
        (m) => m.MfaVerifyComponent
      ),
  },
  {
    path: 'account-locked',
    loadComponent: () =>
      import('./components/account-locked/account-locked.component').then(
        (m) => m.AccountLockedComponent
      ),
  },
  {
    path: 'account-suspended',
    loadComponent: () =>
      import('./components/account-suspended/account-suspended.component').then(
        (m) => m.AccountSuspendedComponent
      ),
  },
  {
    path: 'sessions',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/session-management/session-management.component').then(
        (m) => m.SessionManagementComponent
      ),
  },
  {
    path: 'welcome',
    loadComponent: () =>
      import('./components/welcome/welcome.component').then(
        (m) => m.WelcomeComponent
      ),
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];
