import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

export interface DetailTab {
  key: string;
  label: string;
  icon?: string;
}

/**
 * DetailTabsComponent — pill/underline tab bar for detail pages.
 * Two-way binds `activeKey` via the `activeKeyChange` model.
 */
@Component({
  selector: 'zcc-detail-tabs',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-white/10">
      @for (tab of tabs(); track tab.key) {
        <button
          type="button"
          class="inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors"
          [class]="
            activeKey() === tab.key
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          "
          (click)="activeKey.set(tab.key)"
        >
          @if (tab.icon) {
            <i [class]="tab.icon" class="text-xs" aria-hidden="true"></i>
          }
          {{ tab.label }}
        </button>
      }
    </div>
  `,
})
export class DetailTabsComponent {
  readonly tabs = input<DetailTab[]>([]);
  readonly activeKey = model<string>('');

  readonly activeIndex = computed(() =>
    this.tabs().findIndex((t) => t.key === this.activeKey())
  );
}
