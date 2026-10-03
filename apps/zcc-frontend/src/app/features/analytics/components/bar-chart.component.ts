import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarSeries {
  name: string;
  color: string;
  data: number[];
}

const W = 1000;
const H = 240;
const TICKS = 5;
const MAX_X_LABELS = 11;

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './bar-chart.component.html',
  styleUrl: './bar-chart.component.scss',
})
export class BarChartComponent {
  readonly labels = input.required<string[]>();
  readonly series = input.required<BarSeries[]>();

  protected readonly W = W;
  protected readonly H = H;

  private readonly count = computed(() => this.labels().length);

  private readonly yMax = computed(() =>
    Math.max(1, Math.max(0, ...this.series().flatMap((s) => s.data)))
  );

  readonly yTicks = computed(() => {
    const max = this.yMax();
    Math.pow(10, Math.floor(Math.log10(max / TICKS) || 0));
    return Array.from({ length: TICKS + 1 }, (_, i) => Math.round(max - (max / TICKS) * i));
  });

  private readonly barWidth = computed(() => {
    const n = this.count();
    const seriesCount = this.series().length;
    const groupWidth = (W / n) * 0.8;
    return seriesCount > 0 ? groupWidth / seriesCount : groupWidth;
  });

  readonly bars = computed(() =>
    this.series().map((s, si) => {
      const bw = this.barWidth();
      const groupWidth = (W / this.count()) * 0.8;
      const startX = (W - this.count() * groupWidth) / 2;
      return s.data.map((v, i) => {
        const groupX = startX + i * groupWidth + (si * groupWidth) / this.series().length;
        const x = groupX + si * bw;
        const y = this.yAt(v);
        const height = this.H - y;
        return {
          x,
          y,
          width: bw,
          height: Math.max(1, height),
          value: v,
          label: this.labels()[i],
        };
      });
    })
  );

  readonly xLabels = computed(() => {
    const labels = this.labels();
    const n = labels.length;
    if (!n) return [];
    const step = Math.max(1, Math.ceil((n - 1) / (MAX_X_LABELS - 1)));
    const idx: number[] = [];
    for (let i = 0; i < n; i += step) idx.push(i);
    if (idx[idx.length - 1] !== n - 1 && n - 1 - idx[idx.length - 1] < step / 2) idx.pop();
    if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
    return idx.map((i) => ({
      index: i,
      text: this.shortLabel(labels[i]),
      leftPct: (this.xAt(i) / W) * 100,
    }));
  });

  protected xAt(i: number): number {
    const n = this.count();
    return n <= 1 ? W / 2 : (i / (n - 1)) * W;
  }

  protected yAt(v: number): number {
    return this.H - (v / this.yMax()) * this.H;
  }

  protected shortLabel(iso: string): string {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  protected formatNumber(value: number): string {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toString();
  }

  readonly ariaLabel = computed(() => {
    const totals = this.series()
      .map((s) => `${s.name} total ${s.data.reduce((a, b) => a + b, 0)}`)
      .join(', ');
    return `Bar chart with ${this.count()} categories. ${totals}.`;
  });
}
