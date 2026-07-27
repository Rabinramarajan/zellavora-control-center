import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
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
  private router = inject(Router);
  showAdminLayout = signal(false);

  constructor() {
    // Track router URL to decide when to show the admin layout
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects || event.url || '';
      this.showAdminLayout.set(!url.includes('/auth'));
    });
    
    // Set initial value based on current URL
    const currentUrl = this.router.url || '';
    this.showAdminLayout.set(!currentUrl.includes('/auth'));
  }
}
