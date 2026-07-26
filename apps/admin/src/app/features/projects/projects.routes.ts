import { Routes } from '@angular/router';
import { ProjectsListComponent } from './components/projects-list/projects-list.component';
import { ProjectEditorComponent } from './components/project-editor/project-editor.component';

export const projectsRoutes: Routes = [
  {
    path: '',
    component: ProjectsListComponent,
  },
  {
    path: 'new',
    component: ProjectEditorComponent,
  },
  {
    path: ':id',
    component: ProjectEditorComponent,
  },
];
