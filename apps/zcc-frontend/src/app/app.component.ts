import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';

import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { ThemeService } from './core/services/theme.service';
import { AdminLayoutComponent } from './shared/components/admin-layout/admin-layout.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterOutlet, AdminLayoutComponent],
  template: `
    <div class="min-h-screen bg-slate-50 dark:bg-[#03020c]">
      <!-- Auth pages render in their own layout, outside the app shell and sidebar -->
      @if (showAdminLayout()) {
        <app-admin-layout></app-admin-layout>
      }

      <!-- Show router outlet directly for auth pages -->
      @if (!showAdminLayout()) {
        <router-outlet></router-outlet>
      }
    </div>
  `,
  styles: [],
})
export class AppComponent {
  private readonly router = inject(Router);

  /** Emits the post-redirect URL on every completed navigation. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects || event.url)
    ),
    { initialValue: this.router.url }
  );

  readonly showAdminLayout = computed(() => {
    const url = this.currentUrl();
    return !(url === '/auth' || url.startsWith('/auth/') || url.startsWith('/auth?'));
  });

  constructor() {
    const theme = inject(ThemeService);
    // The sign-in screens are designed dark-only; the chosen theme applies inside the app shell.
    effect(() => theme.forcedTheme.set(this.showAdminLayout() ? null : 'dark'));
  }
}
