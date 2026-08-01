import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type ChipTone = 'green' | 'blue' | 'amber' | 'red' | 'gray' | 'purple' | 'rose';

const TONE_CLASSES: Record<ChipTone, string> = {
  green: 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20',
  blue: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
  amber: 'bg-amber-500/10 text-amber-500 ring-amber-500/20',
  red: 'bg-red-500/10 text-red-400 ring-red-500/20',
  gray: 'bg-slate-500/10 text-slate-400 ring-slate-500/20',
  purple: 'bg-purple-500/10 text-purple-400 ring-purple-500/20',
  rose: 'bg-rose-500/10 text-rose-400 ring-rose-500/20',
};

const STATUS_TONE: Record<string, ChipTone> = {
  ACTIVE: 'green',
  INACTIVE: 'gray',
  LOCKED: 'red',
  PENDING: 'amber',
  SUSPENDED: 'rose',
  allow: 'green',
  deny: 'red',
  ORG: 'blue',
  GLOBAL: 'purple',
  RESOURCE: 'amber',
  SECURITY: 'blue',
  DISTRIBUTION: 'purple',
  PROJECT: 'amber',
  DYNAMIC: 'green',
  API: 'blue',
  FEATURE: 'green',
  DATA: 'amber',
  MENU: 'purple',
  REPORT: 'gray',
  INTEGRATION: 'rose',
};

/**
 * StatusChipComponent — small colored pill for entity status / type / effect.
 * Derives its tone from a known status value; falls back to the passed tone.
 */
@Component({
  selector: 'zcc-status-chip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      [class]="classes()"
      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
    >
      <span
        class="size-1.5 rounded-full"
        [class]="dotClass()"
        aria-hidden="true"
      ></span>
      {{ label() }}
    </span>
  `,
})
export class StatusChipComponent {
  readonly value = input.required<string>();
  readonly label = input<string>('');
  readonly tone = input<ChipTone>('gray');

  readonly resolvedTone = () => STATUS_TONE[this.value()] ?? this.tone();
  readonly classes = () => TONE_CLASSES[this.resolvedTone()];
  readonly dotClass = () =>
    this.resolvedTone() === 'green'
      ? 'bg-emerald-400'
      : this.resolvedTone() === 'red' || this.resolvedTone() === 'rose'
        ? 'bg-red-400'
        : this.resolvedTone() === 'amber'
          ? 'bg-amber-400'
          : this.resolvedTone() === 'blue' || this.resolvedTone() === 'purple'
            ? 'bg-blue-400'
            : 'bg-slate-400';
}
