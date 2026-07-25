import { Routes } from '@angular/router';

import { AdminShell } from './layouts/admin-shell/admin-shell';

export const routes: Routes = [
  {
    path: '',
    component: AdminShell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard-page/dashboard-page').then(
            (m) => m.DashboardPage,
          ),
        title: 'Dashboard',
      },
      {
        path: 'authentication',
        loadComponent: () =>
          import('./features/authentication/pages/authentication-page/authentication-page').then(
            (m) => m.AuthenticationPage,
          ),
        title: 'Authentication',
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/pages/profile-page/profile-page').then((m) => m.ProfilePage),
        title: 'Profile',
      },
      {
        path: 'hero',
        loadComponent: () =>
          import('./features/hero/pages/hero-page/hero-page').then((m) => m.HeroPage),
        title: 'Hero',
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./features/about/pages/about-page/about-page').then((m) => m.AboutPage),
        title: 'About',
      },
      {
        path: 'experience',
        loadComponent: () =>
          import('./features/experience/pages/experience-page/experience-page').then(
            (m) => m.ExperiencePage,
          ),
        title: 'Experience',
      },
      {
        path: 'education',
        loadComponent: () =>
          import('./features/education/pages/education-page/education-page').then(
            (m) => m.EducationPage,
          ),
        title: 'Education',
      },
      {
        path: 'skills',
        loadComponent: () =>
          import('./features/skills/pages/skills-page/skills-page').then((m) => m.SkillsPage),
        title: 'Skills',
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/projects/pages/projects-page/projects-page').then(
            (m) => m.ProjectsPage,
          ),
        title: 'Projects',
      },
      {
        path: 'services',
        loadComponent: () =>
          import('./features/services/pages/services-page/services-page').then(
            (m) => m.ServicesPage,
          ),
        title: 'Services',
      },
      {
        path: 'resume',
        loadComponent: () =>
          import('./features/resume/pages/resume-page/resume-page').then((m) => m.ResumePage),
        title: 'Resume',
      },
      {
        path: 'blog',
        loadComponent: () =>
          import('./features/blog/pages/blog-page/blog-page').then((m) => m.BlogPage),
        title: 'Blog',
      },
      {
        path: 'media',
        loadComponent: () =>
          import('./features/media/pages/media-page/media-page').then((m) => m.MediaPage),
        title: 'Media',
      },
      {
        path: 'contacts',
        loadComponent: () =>
          import('./features/contacts/pages/contacts-page/contacts-page').then(
            (m) => m.ContactsPage,
          ),
        title: 'Contacts',
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/pages/analytics-page/analytics-page').then(
            (m) => m.AnalyticsPage,
          ),
        title: 'Analytics',
      },
      {
        path: 'seo',
        loadComponent: () =>
          import('./features/seo/pages/seo-page/seo-page').then((m) => m.SeoPage),
        title: 'SEO',
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/pages/settings-page/settings-page').then(
            (m) => m.SettingsPage,
          ),
        title: 'Settings',
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/users/pages/users-page/users-page').then((m) => m.UsersPage),
        title: 'Users',
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('./features/roles/pages/roles-page/roles-page').then((m) => m.RolesPage),
        title: 'Roles',
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/pages/notifications-page/notifications-page').then(
            (m) => m.NotificationsPage,
          ),
        title: 'Notifications',
      },
      {
        path: 'activity-logs',
        loadComponent: () =>
          import('./features/activity-logs/pages/activity-logs-page/activity-logs-page').then(
            (m) => m.ActivityLogsPage,
          ),
        title: 'Activity Logs',
      },
      {
        path: 'audit-logs',
        loadComponent: () =>
          import('./features/audit-logs/pages/audit-logs-page/audit-logs-page').then(
            (m) => m.AuditLogsPage,
          ),
        title: 'Audit Logs',
      },
      {
        path: 'developer',
        loadComponent: () =>
          import('./features/developer/pages/developer-page/developer-page').then(
            (m) => m.DeveloperPage,
          ),
        title: 'Developer',
      },
      {
        path: 'ai-assistant',
        loadComponent: () =>
          import('./features/ai-assistant/pages/ai-assistant-page/ai-assistant-page').then(
            (m) => m.AiAssistantPage,
          ),
        title: 'AI Assistant',
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
