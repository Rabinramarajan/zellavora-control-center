import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { LayoutService } from '@core/services/layout.service';

interface BreadcrumbSegment {
  label: string;
  route: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ transform: 'translateY(-10%)', opacity: 0 }),
        animate('200ms ease-out', style({ transform: 'translateY(0)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ transform: 'translateY(-10%)', opacity: 0 })),
      ]),
    ]),
  ],
  template: `
    <!-- Top Header -->
    <header class="h-16 bg-[#05040e] border-b border-[#13112b] px-6 flex items-center justify-between sticky top-0 z-40 font-sans">
      <!-- Left side: Logo, Hamburger and Breadcrumbs -->
      <div class="flex items-center gap-4">


        <!-- Hamburger Menu toggle -->
        <button (click)="layoutService.toggleSidebar()" class="text-slate-400 hover:text-white transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>

        <!-- Breadcrumbs trail -->
        <nav class="flex items-center gap-2 text-xs font-semibold select-none ml-2">
          <ng-container *ngFor="let seg of getBreadcrumbs(); let last = last">
            <a
              *ngIf="seg.route"
              [routerLink]="seg.route"
              class="text-[#a3a1b8] hover:text-white transition"
            >
              {{ seg.label }}
            </a>
            <!-- Active breadcrumb highlighted in vibrant violet/purple -->
            <span *ngIf="!seg.route" class="text-[#8B5CF6]">
              {{ seg.label }}
            </span>
            <!-- Chevron separator -->
            <svg *ngIf="!last" class="w-3 h-3 text-[#4e4b70] mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </ng-container>
        </nav>
      </div>

      <!-- Right side: Notifications & User profile dropdown -->
      <div class="flex items-center gap-5">
        <!-- Notification bell -->
        <div class="relative cursor-pointer group">
          <button class="w-9 h-9 rounded-xl border border-[#13112b] bg-white/5 text-slate-400 flex items-center justify-center hover:text-white transition relative">
            <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
          </button>
          <span class="absolute -top-1 -right-1 bg-[#8B5CF6] text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-md shadow-purple-600/30">
            9+
          </span>
        </div>

        <!-- User profile dropdown toggle -->
        <div class="relative">
          <button
            (click)="toggleUserMenu()"
            class="flex items-center gap-3 p-1.5 rounded-xl border border-transparent hover:bg-white/5 transition-all"
            type="button"
          >
            <!-- User avatar -->
            <div class="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/20 flex items-center justify-center overflow-hidden shrink-0">
              <img
                src="assets/rabin_avatar.jpg"
                alt="Rabin R"
                class="w-full h-full object-cover"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"
              />
              <span class="hidden text-xs font-bold text-purple-300">{{ getInitials(auth.user()?.fullName || 'Rabin R') }}</span>
            </div>
            
            <!-- User details -->
            <div class="text-left hidden sm:block leading-none">
              <div class="text-xs font-bold text-white">
                {{ auth.user()?.fullName || 'Rabin R' }}
              </div>
              <span class="text-[9px] text-[#a3a1b8] mt-1.5 block">
                {{ auth.user()?.role || 'Super Admin' }}
              </span>
            </div>

            <!-- Down arrow chevron -->
            <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          <!-- User dropdown menu -->
          <div
            *ngIf="isUserMenuOpen()"
            @slideDown
            class="absolute right-0 mt-2.5 w-52 glass-panel rounded-2xl shadow-2xl border border-[#13112b] p-2 z-50 text-slate-200"
          >
            <!-- Profile title details -->
            <div class="px-4 py-3 border-b border-[#13112b] mb-1">
              <p class="font-bold text-xs text-white leading-none">
                {{ auth.user()?.fullName || 'Rabin R' }}
              </p>
              <p class="text-[10px] text-slate-400 mt-1.5 leading-none">
                {{ auth.user()?.email || 'rabin@zellavora.com' }}
              </p>
            </div>

            <!-- Options -->
            <a
              routerLink="/settings"
              (click)="closeUserMenu()"
              class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl hover:bg-white/5 text-xs text-[#a3a1b8] hover:text-white transition-colors"
            >
              <span>⚙️</span> Settings
            </a>

            <a
              routerLink="/auth/sessions"
              (click)="closeUserMenu()"
              class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl hover:bg-white/5 text-xs text-[#a3a1b8] hover:text-white transition-colors"
            >
              <span>🖥️</span> Sessions
            </a>

            <!-- Logout action -->
            <button
              (click)="logout()"
              class="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl hover:bg-red-500/10 text-xs text-red-400 hover:text-red-300 transition-colors border-t border-[#13112b] mt-1"
            >
              <span>🚪</span> Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [],
})
export class NavbarComponent {
  auth = inject(AuthService);
  router = inject(Router);
  layoutService = inject(LayoutService);

  isUserMenuOpen = signal(false);

  toggleUserMenu(): void {
    this.isUserMenuOpen.update((v) => !v);
  }

  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  logout(): void {
    this.closeUserMenu();
    this.auth.logout().subscribe();
  }

  getBreadcrumbs(): BreadcrumbSegment[] {
    const url = this.router.url.split('?')[0]; // Strip query parameters
    const segments = url.split('/').filter(s => s);
    
    if (segments.length === 0) {
      return [{ label: 'Dashboard', route: '' }];
    }

    const labelMap: Record<string, string> = {
      dashboard: 'Dashboard',
      portfolio: 'Portfolio',
      profile: 'Profile',
      hero: 'Hero Section',
      about: 'About Section',
      experience: 'Experience',
      education: 'Education',
      skills: 'Skills',
      services: 'Services',
      testimonials: 'Testimonials',
      projects: 'Projects',
      blog: 'Blog',
      media: 'Media',
      analytics: 'Analytics',
      users: 'Users',
      settings: 'Settings',
      admin: 'Admin Console',
      roles: 'Manage Roles',
      resources: 'Resources',
      branches: 'Branches',
      'theme-builder': 'Theme Builder',
      notifications: 'Notifications',
      'audit-logs': 'Audit Logs',
      'system-health': 'System Health',
      'cms-builder': 'CMS Builder',
      new: 'New',
    };

    return segments.map((seg, idx) => {
      const isLast = idx === segments.length - 1;
      const path = '/' + segments.slice(0, idx + 1).join('/');
      
      let label = labelMap[seg.toLowerCase()];
      if (!label) {
        if (/^[0-9a-fA-F-]+$/.test(seg) && seg.length > 8) {
          label = 'Details';
        } else {
          label = this.capitalize(seg.replace(/-/g, ' '));
        }
      }

      return {
        label: label,
        route: isLast ? '' : path
      };
    });
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

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
