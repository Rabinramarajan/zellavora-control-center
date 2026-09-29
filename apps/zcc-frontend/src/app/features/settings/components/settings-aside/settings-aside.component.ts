import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SystemInfoItem } from '../../models/settings.model';
import { SettingsIconComponent } from '../settings-icon/settings-icon.component';

const RING_CIRCUMFERENCE = 100;

@Component({
  selector: 'app-settings-aside',
  standalone: true,
  imports: [SettingsIconComponent, DecimalPipe],
  template: `
    <div class="space-y-6">
      <!-- Account role -->
      <div
        class="glass-panel rounded-2xl p-5 flex items-center gap-4 bg-gradient-to-tr from-violet-950/30 to-transparent"
      >
        <span
          class="w-11 h-11 rounded-xl bg-violet-500/15 text-violet-300 flex items-center justify-center shrink-0"
        >
          <app-settings-icon name="shield" sizeClass="w-5 h-5" />
        </span>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-white truncate">{{ roleName() }}</span>
            <span
              class="px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-300"
              >Active</span
            >
          </div>
          <p class="text-[11px] text-slate-400 mt-1">{{ roleDescription() }}</p>
        </div>
      </div>

      <!-- Security shortcut -->
      <div class="glass-panel rounded-2xl p-5 space-y-4">
        <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quick actions</h3>
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <span
              class="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-300 flex items-center justify-center shrink-0"
            >
              <app-settings-icon name="lock" />
            </span>
            <div class="min-w-0">
              <span class="text-xs font-semibold text-white block">Two-factor auth</span>
              <span class="text-[11px] block" [class]="mfaEnabled() ? 'text-emerald-300' : 'text-slate-500'">
                {{ mfaEnabled() ? 'Protecting your account' : 'Not enabled yet' }}
              </span>
            </div>
          </div>
          <button
            type="button"
            (click)="manageSecurity.emit()"
            class="min-h-[44px] px-3 border border-white/10 bg-white/5 hover:bg-white/10 text-white font-semibold text-xs rounded-lg cursor-pointer transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
          >
            {{ mfaEnabled() ? 'Manage' : 'Enable' }}
          </button>
        </div>
      </div>

      <!-- Storage -->
      <div class="glass-panel rounded-2xl p-5 space-y-4">
        <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Storage usage</h3>
        <div class="flex items-center gap-4">
          <div
            class="relative w-16 h-16 shrink-0"
            role="img"
            [attr.aria-label]="usedPercent() + '% of storage used'"
          >
            <svg class="w-full h-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
              <circle cx="18" cy="18" r="15.9155" fill="none" stroke-width="3" class="stroke-slate-800" />
              <circle
                cx="18"
                cy="18"
                r="15.9155"
                fill="none"
                stroke-width="3.5"
                stroke-linecap="round"
                class="stroke-sky-500"
                [attr.stroke-dasharray]="usedPercent() + ' ' + ringCircumference"
              />
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-xs font-black text-white tabular-nums">
              {{ usedPercent() }}%
            </span>
          </div>
          <div>
            <span class="text-sm font-bold text-white tabular-nums">
              {{ storageUsedGb() | number: '1.0-1' }} GB
              <span class="text-xs text-slate-500 font-medium">/ {{ storageTotalGb() }} GB</span>
            </span>
            <span class="text-[11px] text-slate-500 block mt-0.5">Total storage</span>
          </div>
        </div>
      </div>

      <!-- System info -->
      <div class="glass-panel rounded-2xl p-5 space-y-3">
        <h3 class="text-[11px] font-bold uppercase tracking-wider text-slate-400">System information</h3>
        <dl class="space-y-2.5">
          @for (item of systemInfo(); track item.label) {
            <div class="flex items-center justify-between text-xs">
              <dt class="text-slate-500">{{ item.label }}</dt>
              <dd class="text-white font-semibold tabular-nums">{{ item.value }}</dd>
            </div>
          }
        </dl>
      </div>
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsAsideComponent {
  readonly roleName = input('Super Admin');
  readonly roleDescription = input('Full access to all features and settings.');
  readonly mfaEnabled = input(false);
  readonly storageUsedGb = input(0);
  readonly storageTotalGb = input(1);
  readonly systemInfo = input<readonly SystemInfoItem[]>([]);

  readonly manageSecurity = output<void>();

  protected readonly ringCircumference = RING_CIRCUMFERENCE;
  protected readonly usedPercent = computed(() =>
    Math.min(100, Math.round((this.storageUsedGb() / Math.max(this.storageTotalGb(), 1)) * 100))
  );
}
