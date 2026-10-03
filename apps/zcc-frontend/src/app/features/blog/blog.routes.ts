import { CanDeactivateFn, Routes } from '@angular/router';
import { BlogListComponent } from './blog-list.component';
import { BlogEditorComponent } from './blog-editor.component';

const confirmLeave: CanDeactivateFn<BlogEditorComponent> = (editor) => editor.canLeave();

export const blogRoutes: Routes = [
  { path: '', component: BlogListComponent, data: { title: 'Blog / Insights' } },
  {
    path: 'new',
    component: BlogEditorComponent,
    canDeactivate: [confirmLeave],
    data: { title: 'New Post' },
  },
  {
    path: ':id/edit',
    component: BlogEditorComponent,
    canDeactivate: [confirmLeave],
    data: { title: 'Edit Post' },
  },
  { path: ':id', redirectTo: ':id/edit' },
];
