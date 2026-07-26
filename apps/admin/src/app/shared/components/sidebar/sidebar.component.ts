import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <!-- Sidebar Toggle Button (Mobile) -->
    <button
      (click)="toggleSidebar()"
      class="fixed bottom-6 right-6 md:hidden z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
      [attr.aria-label]="'Toggle sidebar'"
    >
      <span *ngIf="!isSidebarOpen()" class="text-2xl">☰</span>
      <span *ngIf="isSidebarOpen()" class="text-2xl">✕</span>
    </button>

    <!-- Sidebar -->
    <aside
      class="fixed md:static inset-y-0 left-0 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-transform duration-300 transform md:transform-none"
      [class.translate-x-0]="isSidebarOpen()"
      [class.-translate-x-full]="!isSidebarOpen()"
      [attr.aria-label]="'Navigation sidebar'"
    >
      <div class="flex flex-col h-full pt-6">
        <!-- Navigation Section -->
        <nav class="flex-1 px-4 space-y-2">
          <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 mb-4">
            Main
          </p>

          <a
            *ngFor="let item of mainNavItems"
            [routerLink]="item.route"
            routerLinkActive="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
            [routerLinkActiveOptions]="{ exact: false }"
            (click)="closeSidebarOnMobile()"
            class="flex items-center justify-between px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <div class="flex items-center gap-3">
              <span class="text-xl">{{ item.icon }}</span>
              <span class="font-medium">{{ item.label }}</span>
            </div>
            <span
              *ngIf="item.badge"
              class="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
            >
              {{ item.badge }}
            </span>
          </a>

          <!-- Divider -->
          <div class="my-4 border-t border-slate-200 dark:border-slate-700"></div>

          <!-- Admin Section -->
          <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 mb-4">
            Admin
          </p>

          <a
            *ngFor="let item of adminNavItems"
            [routerLink]="item.route"
            routerLinkActive="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
            [routerLinkActiveOptions]="{ exact: false }"
            (click)="closeSidebarOnMobile()"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <span class="text-xl">{{ item.icon }}</span>
            <span class="font-medium">{{ item.label }}</span>
          </a>
        </nav>

        <!-- Bottom Section -->
        <div class="border-t border-slate-200 dark:border-slate-700 p-4 space-y-2">
          <!-- Quick Stats -->
          <div class="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-2">
            <p class="text-xs font-semibold text-slate-600 dark:text-slate-400">Quick Stats</p>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p class="text-slate-500 dark:text-slate-400">Projects</p>
                <p class="text-lg font-bold text-slate-900 dark:text-white">0</p>
              </div>
              <div>
                <p class="text-slate-500 dark:text-slate-400">Posts</p>
                <p class="text-lg font-bold text-slate-900 dark:text-white">0</p>
              </div>
            </div>
          </div>

          <!-- Version -->
          <p class="text-xs text-slate-500 dark:text-slate-400 text-center py-2">
            v1.0.0
          </p>
        </div>
      </div>
    </aside>

    <!-- Backdrop for mobile -->
    <div
      *ngIf="isSidebarOpen()"
      (click)="closeSidebar()"
      class="fixed inset-0 bg-black/50 md:hidden z-40"
    ></div>
  `,
  styles: [],
})
export class SidebarComponent {
  isSidebarOpen = signal(false);

  mainNavItems: NavItem[] = [
    { label: 'Dashboard', icon: '📊', route: '/dashboard' },
    { label: 'Portfolio', icon: '👤', route: '/portfolio' },
    { label: 'Projects', icon: '💼', route: '/projects' },
    { label: 'Blog', icon: '📝', route: '/blog' },
    { label: 'Media', icon: '🖼️', route: '/media' },
    { label: 'Analytics', icon: '📈', route: '/analytics', badge: 3 },
  ];

  adminNavItems: NavItem[] = [
    { label: 'Users', icon: '👥', route: '/users' },
    { label: 'Settings', icon: '⚙️', route: '/settings' },
    { label: 'Admin Console', icon: '🔐', route: '/admin' },
    { label: 'Manage Users', icon: '👤', route: '/admin/users' },
    { label: 'Manage Roles', icon: '🛡️', route: '/admin/roles' },
    { label: 'Resources', icon: '📦', route: '/admin/resources' },
    { label: 'Branches', icon: '🌍', route: '/admin/branches' },
  ];

  toggleSidebar(): void {
    this.isSidebarOpen.update((v) => !v);
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  closeSidebarOnMobile(): void {
    if (window.innerWidth < 768) {
      this.closeSidebar();
    }
  }
}
