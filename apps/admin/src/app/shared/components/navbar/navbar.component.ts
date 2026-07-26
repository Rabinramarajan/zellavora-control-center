import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ transform: 'translateY(-100%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateY(0)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ transform: 'translateY(-100%)', opacity: 0 })),
      ]),
    ]),
  ],
  template: `
    <!-- Navbar -->
    <nav class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <!-- Logo -->
          <div class="flex items-center gap-2">
            <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span class="text-white font-bold text-lg">Z</span>
            </div>
            <span class="font-bold text-slate-900 dark:text-white hidden sm:inline">Zellavora</span>
          </div>

          <!-- Desktop Navigation -->
          <div class="hidden md:flex items-center gap-8">
            <a
              routerLink="/dashboard"
              class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Dashboard
            </a>
            <a
              routerLink="/portfolio"
              class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Portfolio
            </a>
            <a
              routerLink="/projects"
              class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Projects
            </a>
            <a
              routerLink="/blog"
              class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Blog
            </a>
            <a
              routerLink="/analytics"
              class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Analytics
            </a>
          </div>

          <!-- Right Side - Theme Toggle & User Menu -->
          <div class="flex items-center gap-4">
            <!-- Theme Toggle -->
            <button
              (click)="toggleTheme()"
              class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              [attr.aria-label]="isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode'"
            >
              <span *ngIf="!isDarkMode()" class="text-2xl">🌙</span>
              <span *ngIf="isDarkMode()" class="text-2xl">☀️</span>
            </button>

            <!-- User Menu Dropdown -->
            <div class="relative">
              <button
                (click)="toggleUserMenu()"
                class="flex items-center gap-2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                [attr.aria-label]="'User menu for ' + (auth.user()?.fullName || 'User')"
              >
                <!-- User Avatar -->
                <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {{ getInitials(auth.user()?.fullName) }}
                </div>
                <!-- Dropdown Indicator -->
                <span *ngIf="screenSize() !== 'mobile'" class="text-slate-600 dark:text-slate-400">
                  {{ isUserMenuOpen() ? '▲' : '▼' }}
                </span>
              </button>

              <!-- User Dropdown Menu -->
              <div
                *ngIf="isUserMenuOpen()"
                @slideDown
                class="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600"
              >
                <!-- User Info -->
                <div class="px-4 py-3 border-b border-slate-200 dark:border-slate-600">
                  <p class="font-medium text-slate-900 dark:text-white">{{ auth.user()?.fullName }}</p>
                  <p class="text-sm text-slate-600 dark:text-slate-400">{{ auth.user()?.email }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-500 mt-1">
                    Role: <span class="font-medium">{{ auth.user()?.role | uppercase }}</span>
                  </p>
                </div>

                <!-- Menu Items -->
                <a
                  routerLink="/settings"
                  (click)="closeUserMenu()"
                  class="block px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                >
                  ⚙️ Settings
                </a>

                <!-- Logout -->
                <button
                  (click)="logout()"
                  class="w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-t border-slate-200 dark:border-slate-600 transition-colors"
                >
                  🚪 Logout
                </button>
              </div>
            </div>

            <!-- Mobile Menu Button -->
            <button
              (click)="toggleMobileMenu()"
              class="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              [attr.aria-label]="isMobileMenuOpen() ? 'Close menu' : 'Open menu'"
            >
              <span *ngIf="!isMobileMenuOpen()" class="text-2xl">☰</span>
              <span *ngIf="isMobileMenuOpen()" class="text-2xl">✕</span>
            </button>
          </div>
        </div>

        <!-- Mobile Navigation Menu -->
        <div
          *ngIf="isMobileMenuOpen()"
          @slideDown
          class="md:hidden pb-4 space-y-2"
        >
          <a
            routerLink="/dashboard"
            (click)="closeMobileMenu()"
            class="block px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Dashboard
          </a>
          <a
            routerLink="/portfolio"
            (click)="closeMobileMenu()"
            class="block px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Portfolio
          </a>
          <a
            routerLink="/projects"
            (click)="closeMobileMenu()"
            class="block px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Projects
          </a>
          <a
            routerLink="/blog"
            (click)="closeMobileMenu()"
            class="block px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Blog
          </a>
          <a
            routerLink="/media"
            (click)="closeMobileMenu()"
            class="block px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Media
          </a>
          <a
            routerLink="/analytics"
            (click)="closeMobileMenu()"
            class="block px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Analytics
          </a>
        </div>
      </div>
    </nav>
  `,
  styles: [],
})
export class NavbarComponent {
  auth = inject(AuthService);

  isUserMenuOpen = signal(false);
  isMobileMenuOpen = signal(false);
  isDarkMode = signal(this.getInitialTheme());
  screenSize = signal<'mobile' | 'tablet' | 'desktop'>('desktop');

  constructor() {
    this.updateScreenSize();
    window.addEventListener('resize', () => this.updateScreenSize());
  }

  toggleTheme(): void {
    this.isDarkMode.update((v) => !v);
    const html = document.documentElement;
    if (this.isDarkMode()) {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen.update((v) => !v);
  }

  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  logout(): void {
    this.closeUserMenu();
    this.auth.logout().subscribe();
  }

  getInitials(name?: string): string {
    if (!name) return 'Z';
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  private getInitialTheme(): boolean {
    if (typeof localStorage === 'undefined') return false;
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private updateScreenSize(): void {
    const width = window.innerWidth;
    if (width < 768) {
      this.screenSize.set('mobile');
    } else if (width < 1024) {
      this.screenSize.set('tablet');
    } else {
      this.screenSize.set('desktop');
    }
  }
}
