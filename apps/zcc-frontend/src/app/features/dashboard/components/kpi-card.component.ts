import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DashboardIconComponent, DashboardIconName } from './dashboard-icon.component';

export type KpiTone = 'purple' | 'blue' | 'emerald' | 'amber' | 'pink' | 'red';

const TONE_RGB: Record<KpiTone, string> = {
  purple: '139 92 246',
  blue: '59 130 246',
  emerald: '16 185 129',
  amber: '245 158 11',
  pink: '236 72 153',
  red: '244 63 94',
};

const BAR_COUNT = 6;

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [DashboardIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.scss',
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly hint = input<string>('');
  readonly icon = input.required<DashboardIconName>();
  readonly tone = input<KpiTone>('purple');
  /** Percent change against the previous half of the range; null hides the indicator. */
  readonly delta = input<number | null>(null);
  readonly series = input<number[]>([]);
  readonly highlighted = input<boolean>(false);

  readonly toneRgb = computed(() => TONE_RGB[this.tone()]);
  readonly deltaPositive = computed(() => (this.delta() ?? 0) >= 0);
  readonly deltaLabel = computed(() => `${Math.abs(Math.round(this.delta() ?? 0))}%`);

  // Buckets the series into a fixed number of bars so every card has the same rhythm.
  readonly bars = computed(() => {
    const values = this.series();
    if (!values.length || values.every((v) => v === 0)) return [];
    const size = Math.ceil(values.length / BAR_COUNT);
    const buckets: number[] = [];
    for (let i = 0; i < values.length; i += size) {
      buckets.push(values.slice(i, i + size).reduce((a, b) => a + b, 0));
    }
    const max = Math.max(...buckets, 1);
    return buckets.map((b) => Math.max(12, (b / max) * 100));
  });
}
