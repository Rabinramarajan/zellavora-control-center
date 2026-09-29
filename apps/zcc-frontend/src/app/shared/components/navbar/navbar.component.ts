import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { LayoutService } from '@core/services/layout.service';
import { firstValueFrom } from 'rxjs';

interface BreadcrumbSegment {
  label: string;
  route: string;
}

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <!-- Top Header -->
    <header
      class="h-16 bg-[#05040e] border-b border-[#13112b] px-6 flex items-center justify-between sticky top-0 z-40 font-sans"
    >
      <!-- Left side: Logo, Hamburger and Breadcrumbs -->
      <div class="flex items-center gap-4">
        <!-- Hamburger Menu toggle -->
        <button
          (click)="layoutService.toggleSidebar()"
          class="text-slate-400 hover:text-white transition"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <!-- Breadcrumbs trail -->
        <nav class="flex items-center gap-2 text-xs font-semibold select-none ml-2">
          @for (seg of getBreadcrumbs(); track seg; let last = $last) {
            @if (seg.route) {
              <a [routerLink]="seg.route" class="text-[#a3a1b8] hover:text-white transition">
                {{ seg.label }}
              </a>
            }
            <!-- Active breadcrumb highlighted in vibrant violet/purple -->
            @if (!seg.route) {
              <span class="text-[#8B5CF6]">
                {{ seg.label }}
              </span>
            }
            <!-- Chevron separator -->
            @if (!last) {
              <svg
                class="w-3 h-3 text-[#4e4b70] mx-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            }
          }
        </nav>
      </div>

      <!-- Right side: Notifications & User profile dropdown -->
      <div class="flex items-center gap-5">
        <!-- Notification bell (hidden until the notification system is built)
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
        -->

        <!-- User profile dropdown -->
        <div class="relative" (keydown.escape)="closeUserMenu()">
          <button
            (click)="toggleUserMenu()"
            type="button"
            aria-haspopup="menu"
            [attr.aria-expanded]="isUserMenuOpen()"
            class="flex items-center gap-3 min-h-[44px] pl-1.5 pr-3 py-1.5 rounded-2xl border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
            [ngClass]="
              isUserMenuOpen()
                ? 'border-violet-500/70 bg-gradient-to-br from-violet-600/15 to-indigo-600/5 shadow-[0_0_24px_-6px_rgba(139,92,246,0.6)]'
                : 'border-[#1c1940] bg-white/[0.02] hover:border-violet-500/40 hover:bg-white/5'
            "
          >
            <span class="relative shrink-0">
              <span
                class="w-9 h-9 rounded-full p-[2px] bg-gradient-to-br from-violet-500 to-indigo-500 flex"
              >
                <span
                  class="w-full h-full rounded-full bg-[#0c0a1f] overflow-hidden flex items-center justify-center"
                >
                  @if (!avatarFailed()) {
                    <img
                      [src]="avatarSrc()"
                      [alt]="displayName()"
                      class="w-full h-full object-cover"
                      (error)="avatarFailed.set(true)"
                    />
                  } @else {
                    <span class="text-[11px] font-bold text-violet-200">{{
                      getInitials(displayName())
                    }}</span>
                  }
                </span>
              </span>
              <span
                class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#05040e]"
                aria-hidden="true"
              ></span>
            </span>

            <span class="text-left hidden sm:block leading-none">
              <span class="block text-[13px] font-semibold text-white">{{ displayName() }}</span>
              <span class="block text-[11px] text-[#9b98b8] mt-1 capitalize">{{
                displayRole()
              }}</span>
            </span>

            <svg
              class="w-4 h-4 text-violet-300 transition-transform duration-200"
              [class.rotate-180]="isUserMenuOpen()"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          @if (isUserMenuOpen()) {
            <div class="fixed inset-0 z-40" (click)="closeUserMenu()" aria-hidden="true"></div>

            <div
              role="menu"
              class="user-menu-enter absolute right-0 mt-2.5 w-[min(16.5rem,calc(100vw-2rem))] z-50 rounded-2xl border border-violet-500/40 bg-[#0b0a1c]/95 backdrop-blur-xl p-2 shadow-[0_20px_48px_-12px_rgba(0,0,0,0.8),0_0_32px_-10px_rgba(139,92,246,0.45)]"
            >
              <span
                class="absolute -top-[6px] right-8 w-2.5 h-2.5 rotate-45 bg-[#0b0a1c] border-l border-t border-violet-500/40"
                aria-hidden="true"
              ></span>

              <!-- Profile header -->
              <div
                class="relative flex items-center gap-3 rounded-xl border border-white/5 bg-gradient-to-br from-[#15123a] via-[#1a1450] to-[#2a1a78] p-3"
              >
                <span class="relative shrink-0 block w-10 h-10">
                  <span
                    class="block w-10 h-10 rounded-full p-[2px] bg-gradient-to-br from-violet-400 to-fuchsia-500"
                  >
                    <span
                      class="relative block w-full h-full rounded-full bg-[#0c0a1f] overflow-hidden"
                    >
                      <span
                        class="absolute inset-0 flex items-center justify-center text-xs font-bold text-violet-200"
                        >{{ getInitials(displayName()) }}</span
                      >
                      <img
                        [src]="avatarSrc()"
                        alt=""
                        class="absolute inset-0 w-full h-full object-cover"
                        [class.hidden]="avatarFailed()"
                        (error)="avatarFailed.set(true)"
                      />
                    </span>
                  </span>
                  <span
                    class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#15123a]"
                    aria-hidden="true"
                  ></span>
                </span>
                <span class="block min-w-0 flex-1">
                  <span class="block text-sm font-semibold text-white truncate">{{
                    displayName()
                  }}</span>
                  <span class="block text-[11px] text-[#a5a2c9] mt-0.5 capitalize truncate">{{
                    displayRole()
                  }}</span>
                </span>
              </div>

              <!-- Menu items -->
              <div class="mt-2 space-y-1">
                <a
                  routerLink="/settings"
                  (click)="closeUserMenu()"
                  role="menuitem"
                  class="group flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-violet-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
                >
                  <span
                    class="w-8 h-8 shrink-0 rounded-lg bg-violet-500/15 text-violet-300 flex items-center justify-center"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </span>
                  <span class="flex-1 min-w-0">
                    <span class="block text-[13px] font-medium text-white">Settings</span>
                    <span class="block text-[11px] text-[#8f8cb3] truncate"
                      >Account preferences</span
                    >
                  </span>
                  <svg
                    class="w-3.5 h-3.5 text-[#8f8cb3] group-hover:text-white group-hover:translate-x-0.5 transition"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>

                <a
                  routerLink="/auth/sessions"
                  (click)="closeUserMenu()"
                  role="menuitem"
                  class="group flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-indigo-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
                >
                  <span
                    class="w-8 h-8 shrink-0 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="12" rx="2" />
                      <path stroke-linecap="round" d="M8 20h8M12 16v4" />
                    </svg>
                  </span>
                  <span class="flex-1 min-w-0">
                    <span class="block text-[13px] font-medium text-white">Sessions</span>
                    <span class="block text-[11px] text-[#8f8cb3] truncate">Active devices</span>
                  </span>
                  <svg
                    class="w-3.5 h-3.5 text-[#8f8cb3] group-hover:text-white group-hover:translate-x-0.5 transition"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>

              <div
                class="my-2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
                aria-hidden="true"
              ></div>

              <button
                (click)="logout()"
                type="button"
                role="menuitem"
                class="group w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-rose-500/10 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
              >
                <span
                  class="w-8 h-8 shrink-0 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center"
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3M16 16l4-4-4-4M20 12H10"
                    />
                  </svg>
                </span>
                <span class="flex-1 text-[13px] font-medium text-rose-400">Logout</span>
              </button>
            </div>
          }
        </div>
      </div>
    </header>
  `,
  styles: [
    `
      .user-menu-enter {
        animation: user-menu-in 180ms ease-out;
        transform-origin: top right;
      }
      @keyframes user-menu-in {
        from {
          opacity: 0;
          transform: translateY(-6px) scale(0.98);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .user-menu-enter {
          animation: none;
        }
      }
    `,
  ],
})
export class NavbarComponent {
  auth = inject(AuthService);
  router = inject(Router);
  layoutService = inject(LayoutService);

  isUserMenuOpen = signal(false);
  avatarFailed = signal(false);
  avatarSrc = computed(() => this.auth.user()?.avatarUrl || 'assets/rabin_avatar.jpg');
  displayName = computed(() => this.auth.user()?.fullName || 'Rabin R');
  displayRole = computed(() => this.auth.user()?.role || 'Super Admin');

  constructor() {
    // A newly uploaded avatar deserves a fresh load attempt even if the previous one failed.
    effect(() => {
      this.avatarSrc();
      untracked(() => this.avatarFailed.set(false));
    });
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen.update((v) => !v);
  }

  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  logout(): void {
    this.closeUserMenu();
    void firstValueFrom(this.auth.logout());
  }

  getBreadcrumbs(): BreadcrumbSegment[] {
    const url = this.router.url.split('?')[0]; // Strip query parameters
    const segments = url.split('/').filter((s) => s);

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
        route: isLast ? '' : path,
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
