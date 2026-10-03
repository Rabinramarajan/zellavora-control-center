import { CanDeactivateFn, Routes } from '@angular/router';
import { ThemeBuilderComponent } from './theme-builder.component';

const confirmLeave: CanDeactivateFn<ThemeBuilderComponent> = (page) => page.canLeave();

export const themeBuilderRoutes: Routes = [
  {
    path: '',
    component: ThemeBuilderComponent,
    canDeactivate: [confirmLeave],
    data: { title: 'Theme Builder' },
  },
];
