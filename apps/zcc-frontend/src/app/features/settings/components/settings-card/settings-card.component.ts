import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SettingsIconComponent } from '../settings-icon/settings-icon.component';

/** Section shell: header, projected body, and an optional save footer. */
@Component({
  selector: 'app-settings-card',
  standalone: true,
  imports: [SettingsIconComponent],
  template: `
    <section class="glass-panel rounded-3xl overflow-hidden" [attr.aria-labelledby]="headingId()">
      <header class="px-6 pt-6 pb-5 border-b border-white/5">
        <h2 [id]="headingId()" class="text-base font-bold text-white">{{ heading() }}</h2>
        @if (description()) {
          <p class="text-xs text-slate-400 mt-1.5 leading-relaxed">{{ description() }}</p>
        }
      </header>

      <div class="px-6 py-2 divide-y divide-white/5">
        <ng-content />
      </div>

      @if (showSave()) {
        <footer
          class="px-6 py-4 border-t border-white/5 bg-white/[0.015] flex items-center justify-end gap-3"
        >
          @if (dirty()) {
            <span class="text-[11px] text-amber-300/90 mr-auto">You have unsaved changes</span>
            <button
              type="button"
              (click)="reset.emit()"
              [disabled]="saving()"
              class="min-h-[44px] px-4 text-xs font-semibold text-slate-300 hover:text-white rounded-xl cursor-pointer transition-colors duration-200 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
            >
              Discard
            </button>
          }
          <button
            type="button"
            (click)="save.emit()"
            [disabled]="saving() || !dirty()"
            class="min-h-[44px] px-5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-violet-600/20 cursor-pointer transition-colors duration-200 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <app-settings-icon name="check" />
            {{ saving() ? 'Saving…' : 'Save changes' }}
          </button>
        </footer>
      }
    </section>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsCardComponent {
  readonly heading = input.required<string>();
  readonly headingId = input.required<string>();
  readonly description = input('');
  readonly showSave = input(false);
  readonly saving = input(false);
  readonly dirty = input(false);

  readonly save = output<void>();
  readonly reset = output<void>();
}
