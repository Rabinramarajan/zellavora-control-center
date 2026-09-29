import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SettingsTab, SettingsTabId } from '../../models/settings.model';
import { SettingsIconComponent } from '../settings-icon/settings-icon.component';

@Component({
  selector: 'app-settings-nav',
  standalone: true,
  imports: [SettingsIconComponent],
  template: `
    <nav aria-label="Settings sections" class="glass-panel rounded-2xl p-2">
      <ul
        class="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible snap-x scrollbar-none"
        role="list"
      >
        @for (tab of tabs(); track tab.id) {
          @let isActive = tab.id === activeTab();
          <li class="snap-start shrink-0 lg:shrink">
            <button
              type="button"
              (click)="tabSelect.emit(tab.id)"
              [attr.aria-current]="isActive ? 'page' : null"
              class="group w-full min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left cursor-pointer transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
              [class]="
                isActive
                  ? 'bg-violet-500/12 border-violet-500/30 text-white'
                  : 'border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
              "
            >
              <span
                class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200"
                [class]="
                  isActive
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'bg-white/[0.04] text-slate-500 group-hover:text-slate-300'
                "
              >
                <app-settings-icon [name]="tab.icon" />
              </span>
              <span class="min-w-0">
                <span class="block text-xs font-semibold whitespace-nowrap">{{ tab.label }}</span>
                <span
                  class="hidden lg:block text-[11px] mt-0.5 truncate"
                  [class]="isActive ? 'text-violet-300/80' : 'text-slate-500'"
                >
                  {{ tab.description }}
                </span>
              </span>
            </button>
          </li>
        }
      </ul>
    </nav>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsNavComponent {
  readonly tabs = input.required<readonly SettingsTab[]>();
  readonly activeTab = input.required<SettingsTabId>();
  readonly tabSelect = output<SettingsTabId>();
}
