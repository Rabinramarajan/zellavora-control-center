import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '@core/auth/auth.store';

const IAM_MENU_KEY = 'iam';

const LINK_BASE =
  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors';
const LINK_IDLE = 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5';
const LINK_ACTIVE = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400';

/**
 * IAM shell — vertical nav rail for the Identity & Access console. Items come
 * from the backend's permission-filtered menu (the `iam` node), so hidden
 * entries never reach the client. Groups render their children indented.
 */
@Component({
  selector: 'zcc-iam-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="flex h-full">
      <aside
        class="flex w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-gray-200 dark:border-white/10 p-3"
      >
        <h2 class="px-2 pb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {{ title() }}
        </h2>
        @for (item of navItems(); track item.id) {
          @if (item.children.length) {
            <div
              class="flex items-center gap-2.5 px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >
              <span class="text-sm" aria-hidden="true">{{ item.icon }}</span>
              {{ item.label }}
            </div>
            @for (child of item.children; track child.id) {
              <a
                [routerLink]="child.route"
                routerLinkActive
                #crla="routerLinkActive"
                [class]="(crla.isActive ? linkActive : linkIdle) + ' ' + linkBase + ' ml-4'"
              >
                <span class="text-sm" aria-hidden="true">{{ child.icon }}</span>
                {{ child.label }}
              </a>
            }
          } @else {
            <a
              [routerLink]="item.route"
              routerLinkActive
              #rla="routerLinkActive"
              [class]="(rla.isActive ? linkActive : linkIdle) + ' ' + linkBase"
            >
              <span class="text-sm" aria-hidden="true">{{ item.icon }}</span>
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
  private readonly authStore = inject(AuthStore);
  private readonly iamNode = computed(() =>
    this.authStore.menu().find((node) => node.key === IAM_MENU_KEY),
  );

  protected readonly title = computed(() => this.iamNode()?.label ?? 'Identity & Access');
  protected readonly navItems = computed(() => this.iamNode()?.children ?? []);

  protected readonly linkBase = LINK_BASE;
  protected readonly linkIdle = LINK_IDLE;
  protected readonly linkActive = LINK_ACTIVE;
}
