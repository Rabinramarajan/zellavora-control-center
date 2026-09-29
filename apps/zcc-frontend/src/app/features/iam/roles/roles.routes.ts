import { Routes } from '@angular/router';
import { RolesListComponent } from './roles-list.component';
import { RolesDetailComponent } from './roles-detail.component';

export const rolesRoutes: Routes = [
  { path: '', component: RolesListComponent, data: { title: 'Roles' } },
  { path: 'new', redirectTo: '', pathMatch: 'full' },
  { path: ':id', component: RolesDetailComponent, data: { title: 'Role Details' } },
];
