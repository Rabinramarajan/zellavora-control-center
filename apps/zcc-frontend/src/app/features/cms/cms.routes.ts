import { Routes } from '@angular/router';

export const cmsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./page-list/cms-page-list.component').then((m) => m.CmsPageListComponent),
    data: { title: 'CMS / Pages' },
  },
  {
    path: 'new',
    loadComponent: () => import('./page-list/cms-page-list.component').then((m) => m.CmsPageListComponent),
    data: { title: 'CMS / Pages', openCreate: true },
  },
  {
    path: ':id/builder',
    loadComponent: () => import('./page-builder/cms-page-builder.component').then((m) => m.CmsPageBuilderComponent),
    data: { title: 'Page Builder' },
  },
];
