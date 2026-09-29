import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SettingsIconName } from '../../models/settings.model';
import { SettingsIconComponent } from '../settings-icon/settings-icon.component';

/** Label + hint on the left, projected control on the right (stacked on mobile). */
@Component({
  selector: 'app-setting-row',
  standalone: true,
  imports: [SettingsIconComponent],
  template: `
    <div
      class="py-5 flex flex-col md:flex-row gap-3 md:gap-6"
      [class.md:items-center]="!alignTop()"
      [class.md:items-start]="alignTop()"
    >
      <div class="md:w-5/12 flex gap-3">
        @if (icon(); as name) {
          <span
            class="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-300 flex items-center justify-center shrink-0"
          >
            <app-settings-icon [name]="name" />
          </span>
        }
        <div class="min-w-0">
          <label [attr.for]="controlId()" class="block text-xs font-semibold text-white">
            {{ label() }}
          </label>
          @if (hint()) {
            <p class="text-[11px] text-slate-400 mt-1 leading-relaxed">{{ hint() }}</p>
          }
        </div>
      </div>
      <div class="md:flex-1 md:max-w-sm md:ml-auto w-full">
        <ng-content />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingRowComponent {
  readonly label = input.required<string>();
  readonly hint = input('');
  readonly icon = input<SettingsIconName | null>(null);
  readonly controlId = input<string | null>(null);
  readonly alignTop = input(false);
}
