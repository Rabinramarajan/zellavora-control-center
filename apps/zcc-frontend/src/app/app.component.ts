import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';

import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { AnalyticsTrackerService } from './core/analytics/analytics-tracker.service';
import { AdminLayoutComponent } from './shared/components/admin-layout/admin-layout.component';
import { ThemeService } from './core/services/theme/theme.service';
import { ThemeRuntimeService } from './core/services/theme/theme-runtime.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterOutlet, AdminLayoutComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
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
    inject(AnalyticsTrackerService).start();
    // Constructed eagerly so the organization theme applies right after sign-in.
    inject(ThemeRuntimeService);
    const theme = inject(ThemeService);
    // The sign-in screens are designed dark-only; the chosen theme applies inside the app shell.
    effect(() => theme.forcedTheme.set(this.showAdminLayout() ? null : 'dark'));
  }
}
