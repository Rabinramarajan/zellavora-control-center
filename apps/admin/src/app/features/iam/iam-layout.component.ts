import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PermissionService } from '@core/rbac/services/permission.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  permission: string;
}

const NAV: NavItem[] = [
  { label: 'Users', route: 'users', icon: 'pi pi-users', permission: 'users:read' },
  { label: 'Roles', route: 'roles', icon: 'pi pi-shield', permission: 'roles:read' },
  { label: 'Groups', route: 'groups', icon: 'pi pi-sitemap', permission: 'groups:read' },
  { label: 'Resources', route: 'resources', icon: 'pi pi-database', permission: 'resources:read' },
];

/**
 * IAM shell — vertical tab rail for the Admin Console (Users / Roles / Groups /
 * Resources). Child feature routes render in the outlet.
 */
@Component({
  selector: 'zcc-iam-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="flex h-full">
      <aside
        class="flex w-52 shrink-0 flex-col gap-1 border-r border-gray-200 dark:border-white/10 p-3"
      >
        <h2 class="px-2 pb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Identity &amp; Access
        </h2>
        @for (item of navItems(); track item.route) {
          @if (permissions.canSync(item.permission)) {
            <a
              [routerLink]="item.route"
              routerLinkActive="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              #rla="routerLinkActive"
              [class]="
                rla.isActive
                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
              "
              class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <i [class]="item.icon" class="text-sm" aria-hidden="true"></i>
              {{ item.label }}
            </a>
          }
        }
      </aside>

      <main class="min-w-0 flex-1 p-6">
        <router-outlet />
      </main>
    </div>
  `,
})
export class IamLayoutComponent {
  readonly permissions = inject(PermissionService);
  readonly navItems = signal(NAV);
}
