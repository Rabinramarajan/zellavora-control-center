import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TrendChartComponent } from '../../dashboard/components/trend-chart.component';

export type KpiTone = 'purple' | 'blue' | 'emerald' | 'amber' | 'pink' | 'red';

const TONE_CLASSES: Record<KpiTone, string> = {
  purple: 'bg-purple-500/15 text-purple-400 ring-purple-500/20',
  blue: 'bg-blue-500/15 text-blue-400 ring-blue-500/20',
  emerald: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/20',
  amber: 'bg-amber-500/15 text-amber-400 ring-amber-500/20',
  pink: 'bg-pink-500/15 text-pink-400 ring-pink-500/20',
  red: 'bg-red-500/15 text-red-400 ring-red-500/20',
};

const TONE_ICON_BG: Record<KpiTone, string> = {
  purple: 'bg-purple-500/20',
  blue: 'bg-blue-500/20',
  emerald: 'bg-emerald-500/20',
  amber: 'bg-amber-500/20',
  pink: 'bg-pink-500/20',
  red: 'bg-red-500/20',
};

const TONE_COLORS: Record<KpiTone, string> = {
  purple: '#a855f7',
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  pink: '#ec4899',
  red: '#ef4444',
};

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TrendChartComponent],
  host: { class: 'kpi-card' },
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.scss',
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number | string>();
  readonly hint = input<string>();
  readonly icon = input.required<string>();
  readonly tone = input.required<KpiTone>();
  readonly delta = input<number | null>(null);
  readonly series = input<number[]>([]);

  protected readonly toneClass = computed(() => TONE_CLASSES[this.tone()]);
  protected readonly iconBgClass = computed(() => TONE_ICON_BG[this.tone()]);
  protected readonly toneColor = computed(() => TONE_COLORS[this.tone()]);
  protected readonly deltaClass = computed(() => {
    const d = this.delta();
    if (d === null || d === 0) return 'text-slate-400';
    return d > 0 ? 'text-emerald-400' : 'text-red-400';
  });
  protected readonly deltaIcon = computed(() => {
    const d = this.delta();
    if (d === null || d === 0) return 'pi pi-minus';
    return d > 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down';
  });
  protected readonly absDelta = computed(() => {
    const d = this.delta();
    return d === null ? '' : Math.abs(d).toFixed(1) + '%';
  });

  protected readonly hasTrend = computed(() => this.series().length > 0);

  protected generateLabels(): string[] {
    return this.series().map((_, i) => `Day ${i + 1}`);
  }

  protected getToneColor(): string {
    return this.toneColor();
  }
}
