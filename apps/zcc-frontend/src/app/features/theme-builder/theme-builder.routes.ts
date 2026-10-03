import { CanDeactivateFn, Routes } from '@angular/router';
import { ThemesListComponent } from './themes-list.component';
import { ThemeEditorComponent } from './theme-editor.component';

const confirmLeave: CanDeactivateFn<ThemeEditorComponent> = (editor) => editor.canLeave();

export const themeBuilderRoutes: Routes = [
  { path: '', component: ThemesListComponent, data: { title: 'Theme Builder' } },
  {
    path: 'new',
    component: ThemeEditorComponent,
    canDeactivate: [confirmLeave],
    data: { title: 'New Theme' },
  },
  {
    path: ':id',
    component: ThemeEditorComponent,
    canDeactivate: [confirmLeave],
    data: { title: 'Theme Detail' },
  },
];
