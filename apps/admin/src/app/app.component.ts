import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { AdminLayoutComponent } from './shared/components/admin-layout/admin-layout.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, AdminLayoutComponent],
  template: `
    <div class="min-h-screen bg-[#03020c]">
      <!-- Show admin layout for all pages except auth (login/register) -->
      <app-admin-layout *ngIf="showAdminLayout()"></app-admin-layout>

      <!-- Show router outlet directly for auth pages -->
      <router-outlet *ngIf="!showAdminLayout()"></router-outlet>
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
    return !url.includes('/auth');
  });
}
