import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// Convert bookmarked hash routes before Angular reads the initial URL.
if (window.location.hash.startsWith('#/')) {
  const route = window.location.hash.slice(1);
  const target = new URL(`${window.location.origin}${route}`);
  if (!target.search) target.search = window.location.search;
  if (target.origin === window.location.origin) {
    window.history.replaceState(window.history.state, '', target.pathname + target.search + target.hash);
  }
}

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
