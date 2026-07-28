import { Component, signal, inject } from '@angular/core';
import { LayoutService } from '@core/services/layout.service';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface SubNavItem {
  label: string;
  route: string;
  path: string;
}

interface NavItem {
  label: string;
  icon: string;
  route: string;
  path: string;
  badge?: number;
  children?: SubNavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <!-- Sidebar Toggle Button (Mobile) -->
    <button
      (click)="layoutService.toggleSidebar()"
      class="fixed bottom-6 right-6 md:hidden z-50 w-14 h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
      [attr.aria-label]="'Toggle sidebar'"
    >
      <span *ngIf="!layoutService.isSidebarOpen()" class="text-2xl">☰</span>
      <span *ngIf="layoutService.isSidebarOpen()" class="text-2xl">✕</span>
    </button>

    <!-- Sidebar -->
    <aside
      class="fixed md:static inset-y-0 left-0 h-full bg-[#05040e] border-r border-[#13112b] transition-all duration-300 transform md:transform-none flex flex-col overflow-hidden animate-all"
      [class.w-64]="!layoutService.isSidebarCollapsed()"
      [class.w-20]="layoutService.isSidebarCollapsed()"
      [class.translate-x-0]="layoutService.isSidebarOpen()"
      [class.-translate-x-full]="!layoutService.isSidebarOpen()"
      [attr.aria-label]="'Navigation sidebar'"
    >
      <div class="flex flex-col h-full">
        <!-- Logo Header (aligned with navbar h-16) -->
        <div class="h-16 flex items-center gap-3 px-6 border-b border-[#13112b] shrink-0 mb-4 transition-all duration-300"
             [class.justify-center]="layoutService.isSidebarCollapsed()"
             [class.px-2]="layoutService.isSidebarCollapsed()">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
            <span class="text-white font-extrabold text-base">Z</span>
          </div>
          <div *ngIf="!layoutService.isSidebarCollapsed()" class="transition-opacity duration-300">
            <div class="text-[11px] font-bold tracking-wider leading-none text-white">ZELLAVORA</div>
            <div class="text-[8px] tracking-widest text-[#4f46e5] font-semibold mt-0.5">CONTROL CENTER</div>
          </div>
        </div>

        <!-- Navigation Section -->
        <nav class="flex-1 overflow-y-auto px-4 space-y-4 mb-6 custom-sidebar-scrollbar">
          <!-- Main Category -->
          <div>
            <p *ngIf="!layoutService.isSidebarCollapsed()" class="text-[9px] font-bold text-[#474466] uppercase tracking-wider px-3 mb-3">
              MAIN NAVIGATION
            </p>
            <div *ngIf="layoutService.isSidebarCollapsed()" class="border-t border-[#13112b] my-4 mx-1"></div>

            <div class="space-y-1">
              <div *ngFor="let item of mainNavItems" class="space-y-1">
                <!-- Parent Link -->
                <a
                  [routerLink]="item.route"
                  routerLinkActive="bg-[#13112b] text-white"
                  [routerLinkActiveOptions]="{ exact: item.route === '/portfolio' || item.route === '/dashboard' ? true : false }"
                  (click)="item.children ? togglePortfolio($event) : closeSidebarOnMobile()"
                  [class.justify-center]="layoutService.isSidebarCollapsed()"
                  class="flex items-center justify-between px-3 py-2 rounded-xl text-[#a3a1b8] hover:bg-[#13112b]/50 hover:text-white transition-all text-xs font-semibold cursor-pointer"
                >
                  <div class="flex items-center gap-3">
                    <span class="text-base shrink-0">{{ item.icon }}</span>
                    <span *ngIf="!layoutService.isSidebarCollapsed()">{{ item.label }}</span>
                  </div>
                  <span class="text-[9px] text-[#4e4b70] font-normal font-mono" *ngIf="!layoutService.isSidebarCollapsed() && (!item.children || !isPortfolioExpanded())">{{ item.path }}</span>
                </a>

                <!-- Submenu for Portfolio (if active/expanded) -->
                <div *ngIf="item.children && isPortfolioExpanded() && !layoutService.isSidebarCollapsed()" class="pl-3.5 pr-1 py-1 space-y-1 border-l border-[#13112b] ml-5">
                  <a
                    *ngFor="let sub of item.children"
                    [routerLink]="sub.route"
                    routerLinkActive="active-sub text-white shadow-lg shadow-purple-600/10"
                    [routerLinkActiveOptions]="{ exact: true }"
                    (click)="closeSidebarOnMobile()"
                    class="flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#8b88a5] hover:bg-[#13112b]/30 hover:text-white transition-all"
                  >
                    <span>{{ sub.label }}</span>
                    <span class="text-[8px] text-[#4e4b70] font-normal font-mono sub-path">{{ sub.path }}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <!-- Admin Category -->
          <div>
            <p *ngIf="!layoutService.isSidebarCollapsed()" class="text-[9px] font-bold text-[#474466] uppercase tracking-wider px-3 mb-3">
              ADMIN NAVIGATION
            </p>
            <div *ngIf="layoutService.isSidebarCollapsed()" class="border-t border-[#13112b] my-4 mx-1"></div>

            <div class="space-y-1">
              <a
                *ngFor="let item of adminNavItems"
                [routerLink]="item.route"
                routerLinkActive="bg-[#13112b] text-white"
                (click)="closeSidebarOnMobile()"
                [class.justify-center]="layoutService.isSidebarCollapsed()"
                class="flex items-center justify-between px-3 py-2 rounded-xl text-[#a3a1b8] hover:bg-[#13112b]/50 hover:text-white transition-all text-xs font-semibold cursor-pointer"
              >
                <div class="flex items-center gap-3">
                  <span class="text-base shrink-0">{{ item.icon }}</span>
                  <span *ngIf="!layoutService.isSidebarCollapsed()">{{ item.label }}</span>
                </div>
                <span *ngIf="!layoutService.isSidebarCollapsed()" class="text-[9px] text-[#4e4b70] font-normal font-mono">{{ item.path }}</span>
              </a>
            </div>
          </div>
        </nav>

        <!-- Upgrade Section (Fixed at bottom) -->
        <div *ngIf="!layoutService.isSidebarCollapsed()" class="p-4 shrink-0 mt-auto border-t border-[#13112b] transition-all duration-300">
          <div class="glass-panel p-4 rounded-2xl relative overflow-hidden bg-gradient-to-br from-purple-900/40 via-blue-900/10 to-transparent border border-purple-500/20">
            <div class="absolute -right-2 -top-2 w-10 h-10 bg-purple-500/10 rounded-full blur-md"></div>
            <div class="absolute -left-2 -bottom-2 w-10 h-10 bg-indigo-500/10 rounded-full blur-md"></div>

            <div class="flex items-center gap-2">
              <span class="text-lg">👑</span>
              <h5 class="text-xs font-bold text-white">Upgrade to Pro</h5>
            </div>
            <p class="text-[10px] text-slate-400 mt-1.5 leading-normal">Unlock advanced features and priority support.</p>
            <button class="mt-3.5 w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-[10px] rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center justify-center gap-1">
              Upgrade Now &rarr;
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Backdrop for mobile -->
    <div
      *ngIf="layoutService.isSidebarOpen()"
      (click)="layoutService.closeSidebar()"
      class="fixed inset-0 bg-black/50 md:hidden z-40"
    ></div>
  `,
  styles: [
    `
      .active-sub {
        background: linear-gradient(90deg, #7c3aed 0%, #6366f1 100%) !important;
      }
      .active-sub .sub-path {
        color: #c084fc !important;
      }
      .custom-sidebar-scrollbar::-webkit-scrollbar {
        width: 4px;
      }
      .custom-sidebar-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-sidebar-scrollbar::-webkit-scrollbar-thumb {
        background: #13112b;
        border-radius: 2px;
      }
    `,
  ],
})
export class SidebarComponent {
  layoutService = inject(LayoutService);
  isPortfolioExpanded = signal(true); // Defaults to expanded in the mockup

  mainNavItems: NavItem[] = [
    { label: 'Dashboard', icon: '📊', route: '/dashboard', path: '/dashboard' },
    {
      label: 'Portfolio',
      icon: '👤',
      route: '/portfolio',
      path: '/portfolio',
      children: [
        { label: 'Overview', route: '/portfolio/profile', path: '/profile' },
        { label: 'About', route: '/portfolio/about', path: '/about' },
        { label: 'Experience', route: '/portfolio/experience', path: '/experience' },
        { label: 'Education', route: '/portfolio/education', path: '/education' },
        { label: 'Skills', route: '/portfolio/skills', path: '/skills' },
        { label: 'Services', route: '/portfolio/services', path: '/services' },
        { label: 'Testimonials', route: '/portfolio/testimonials', path: '/testimonials' }
      ]
    },
    { label: 'Projects', icon: '💼', route: '/projects', path: '/projects' },
    { label: 'Blog', icon: '📝', route: '/blog', path: '/blog' },
    { label: 'Media', icon: '🖼️', route: '/media', path: '/media' },
    { label: 'Analytics', icon: '📈', route: '/analytics', path: '/analytics', badge: 3 },
  ];

  adminNavItems: NavItem[] = [
    { label: 'Users', icon: '👥', route: '/users', path: '/users' },
    { label: 'Settings', icon: '⚙️', route: '/settings', path: '/settings' },
    { label: 'Admin Console', icon: '🔐', route: '/admin', path: '/admin' },
    { label: 'Manage Users', icon: '👤', route: '/admin/users', path: '/admin/users' },
    { label: 'Manage Roles', icon: '🛡️', route: '/admin/roles', path: '/admin/roles' },
    { label: 'Resources', icon: '📦', route: '/admin/resources', path: '/admin/resources' },
    { label: 'Branches', icon: '🌍', route: '/admin/branches', path: '/admin/branches' },
  ];

  toggleSidebar(): void {
    this.layoutService.toggleSidebar();
  }

  closeSidebar(): void {
    this.layoutService.closeSidebar();
  }

  closeSidebarOnMobile(): void {
    if (window.innerWidth < 768) {
      this.layoutService.closeSidebar();
    }
  }

  togglePortfolio(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.isPortfolioExpanded.update((v) => !v);
  }
}
