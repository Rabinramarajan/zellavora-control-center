import { Routes } from '@angular/router';
import { FreelancerSheetsComponent } from './freelancer-sheets.component';

export const freelancerSheetsRoutes: Routes = [
  {
    path: '',
    component: FreelancerSheetsComponent,
    children: [
      {
        path: 'daily',
        children: [
          { path: '', redirectTo: 'list', pathMatch: 'full' },
          { path: 'list', component: FreelancerSheetsComponent },
          { path: 'new', component: FreelancerSheetsComponent },
          { path: ':id/edit', component: FreelancerSheetsComponent },
          { path: ':id/view', component: FreelancerSheetsComponent },
        ],
      },
      {
        path: 'monthly',
        children: [
          { path: '', redirectTo: 'list', pathMatch: 'full' },
          { path: 'list', component: FreelancerSheetsComponent },
          { path: 'new', component: FreelancerSheetsComponent },
          { path: ':id/view', component: FreelancerSheetsComponent },
        ],
      },
      {
        path: 'approval',
        component: FreelancerSheetsComponent,
      },
      {
        path: '',
        redirectTo: 'daily/list',
        pathMatch: 'full',
      },
    ],
  },
];
