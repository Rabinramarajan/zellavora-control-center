import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { AdminLayoutComponent } from './shared/components/admin-layout/admin-layout.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, AdminLayoutComponent],
  template: `
    <div class="min-h-screen bg-white dark:bg-slate-950">
      <!-- Show admin layout for authenticated users -->
      <app-admin-layout *ngIf="isAuthenticated()"></app-admin-layout>

      <!-- Show router outlet for auth pages (login, register) -->
      <router-outlet *ngIf="!isAuthenticated()"></router-outlet>
    </div>
  `,
  styles: [],
})
export class AppComponent {
  auth = inject(AuthService);
  isAuthenticated = computed(() => this.auth.isAuthenticated());
}
