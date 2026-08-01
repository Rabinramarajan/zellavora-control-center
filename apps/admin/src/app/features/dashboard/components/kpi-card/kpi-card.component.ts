import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type KpiTone = 'purple' | 'blue' | 'emerald' | 'amber' | 'red' | 'pink';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="glass-panel p-5 rounded-2xl relative overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
      [attr.aria-label]="label() + ': ' + value()"
    >
      <div class="flex justify-between items-start gap-3">
        <div class="min-w-0">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            {{ label() }}
          </span>
          <span class="text-2xl font-black text-white tracking-tight mt-1.5 block tabular-nums">
            {{ value() }}
          </span>
          @if (hint()) {
            <span class="text-[10px] text-slate-500 font-semibold mt-1 block">{{ hint() }}</span>
          }
        </div>
        <div
          class="w-10 h-10 rounded-xl border flex items-center justify-center text-base shrink-0"
          [ngClass]="iconClasses()"
        >
          {{ icon() }}
        </div>
      </div>
      <div class="absolute inset-x-0 bottom-0 h-px" [ngClass]="accentClasses()"></div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCardComponent {
  readonly label = input<string>('');
  readonly value = input<string | number>('0');
  readonly hint = input<string>('');
  readonly icon = input<string>('📊');
  readonly tone = input<KpiTone>('purple');

  readonly iconClasses = () => {
    const tones: Record<KpiTone, string> = {
      purple: 'bg-purple-600/10 border-purple-500/20 text-purple-400',
      blue: 'bg-blue-600/10 border-blue-500/20 text-blue-400',
      emerald: 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400',
      amber: 'bg-amber-600/10 border-amber-500/20 text-amber-400',
      red: 'bg-red-600/10 border-red-500/20 text-red-400',
      pink: 'bg-pink-600/10 border-pink-500/20 text-pink-400',
    };
    return tones[this.tone()];
  };

  readonly accentClasses = () => {
    const tones: Record<KpiTone, string> = {
      purple: 'bg-gradient-to-r from-purple-500 to-indigo-500',
      blue: 'bg-gradient-to-r from-blue-500 to-cyan-500',
      emerald: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      amber: 'bg-gradient-to-r from-amber-500 to-orange-500',
      red: 'bg-gradient-to-r from-red-500 to-rose-500',
      pink: 'bg-gradient-to-r from-pink-500 to-fuchsia-500',
    };
    return tones[this.tone()];
  };
}
