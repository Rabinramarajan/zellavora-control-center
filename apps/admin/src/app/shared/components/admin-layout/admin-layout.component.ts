import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, SidebarComponent],
  template: `
    <div class="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors flex flex-col">
      <!-- Navbar -->
      <app-navbar></app-navbar>

      <!-- Main Layout with Sidebar -->
      <div class="flex flex-1 overflow-hidden">
        <!-- Sidebar (hidden on mobile, shown on desktop) -->
        <div class="hidden md:block w-64 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto">
          <app-sidebar></app-sidebar>
        </div>

        <!-- Main Content -->
        <main class="flex-1 overflow-y-auto">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <router-outlet></router-outlet>
          </div>

          <!-- Footer -->
          <footer class="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 mt-16">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
                <p class="text-sm text-slate-600 dark:text-slate-400">
                  © 2026 Zellavora Control Center. All rights reserved.
                </p>
                <div class="flex gap-6 text-sm">
                  <a href="#" class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                    Privacy
                  </a>
                  <a href="#" class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                    Terms
                  </a>
                  <a href="#" class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                    Support
                  </a>
                </div>
              </div>
            </div>
          </footer>
        </main>

        <!-- Mobile Sidebar (shown via button) -->
        <div class="md:hidden">
          <app-sidebar></app-sidebar>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class AdminLayoutComponent {}
