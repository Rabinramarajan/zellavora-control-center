import { Routes } from '@angular/router';
import { GroupsListComponent } from './groups-list.component';
import { GroupsDetailComponent } from './groups-detail.component';

export const groupsRoutes: Routes = [
  { path: '', component: GroupsListComponent, data: { title: 'Groups' } },
  { path: ':id', component: GroupsDetailComponent, data: { title: 'Group Details' } },
];
