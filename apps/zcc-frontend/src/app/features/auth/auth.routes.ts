import { Routes } from '@angular/router';
import { guestGuard, mfaChallengeGuard, registrationGuard } from '../../core/auth/auth.guard';
import { AuthLayoutComponent } from './layout/auth-layout.component';

/** Public / auth pages. They render in the auth layout, never in the app shell. */
export const authRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    // Sign-in and registration own a full-screen composition, so they skip the shared layout.
    path: 'login',
    title: 'Sign in · Zelavora Nexus',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    title: 'Create account · ZCC',
    canActivate: [guestGuard, registrationGuard],
    loadComponent: () => import('./pages/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: '',
    component: AuthLayoutComponent,
    children: [
      {
        path: 'accept-invitation',
        title: 'Accept invitation · ZCC',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./pages/accept-invitation/accept-invitation.page').then(
            (m) => m.AcceptInvitationPage
          ),
      },
      {
        path: 'verify-email',
        title: 'Verify email · ZCC',
        loadComponent: () =>
          import('./pages/verify-email/verify-email.page').then((m) => m.VerifyEmailPage),
      },
      {
        path: 'resend-verification',
        title: 'Resend verification · ZCC',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./pages/resend-verification/resend-verification.page').then(
            (m) => m.ResendVerificationPage
          ),
      },
      {
        path: 'forgot-password',
        title: 'Forgot password · ZCC',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./pages/forgot-password/forgot-password.page').then((m) => m.ForgotPasswordPage),
      },
      {
        path: 'reset-password',
        title: 'Reset password · ZCC',
        loadComponent: () =>
          import('./pages/reset-password/reset-password.page').then((m) => m.ResetPasswordPage),
      },
      {
        path: 'password-reset-success',
        title: 'Password updated · ZCC',
        loadComponent: () =>
          import('./pages/password-reset-success/password-reset-success.page').then(
            (m) => m.PasswordResetSuccessPage
          ),
      },
      {
        path: 'two-factor',
        title: 'Two-factor authentication · ZCC',
        canActivate: [guestGuard, mfaChallengeGuard],
        loadComponent: () =>
          import('./pages/two-factor/two-factor.page').then((m) => m.TwoFactorPage),
      },
      {
        path: 'recovery-code',
        title: 'Recovery code · ZCC',
        canActivate: [guestGuard, mfaChallengeGuard],
        loadComponent: () =>
          import('./pages/recovery-code/recovery-code.page').then((m) => m.RecoveryCodePage),
      },
      {
        path: 'account-locked',
        title: 'Account locked · ZCC',
        loadComponent: () =>
          import('./pages/account-locked/account-locked.page').then((m) => m.AccountLockedPage),
      },
      {
        path: 'session-expired',
        title: 'Session expired · ZCC',
        loadComponent: () =>
          import('./pages/session-expired/session-expired.page').then((m) => m.SessionExpiredPage),
      },
    ],
  },
];
