import { Routes } from '@angular/router';
import { ProjectsListComponent } from './components/projects-list/projects-list.component';
import { ProjectEditorComponent } from './components/project-editor/project-editor.component';

export const projectsRoutes: Routes = [
  {
    path: '',
    component: ProjectsListComponent,
    data: { breadcrumb: 'Projects' },
  },
  {
    path: 'new',
    component: ProjectEditorComponent,
    data: { breadcrumb: 'New Project' },
  },
  {
    path: ':id',
    component: ProjectEditorComponent,
    data: { breadcrumb: 'Project' },
  },
];
