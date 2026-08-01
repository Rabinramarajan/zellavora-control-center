import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  input,
  effect,
  viewChild,
  signal,
} from '@angular/core';
import ApexCharts from 'apexcharts';
import type { ApexOptions } from 'apexcharts';

/**
 * Lightweight, framework-neutral ApexCharts wrapper.
 *
 * Accepts a signal input (`chartConfig`) so the chart is rebuilt whenever the
 * config changes (e.g. after new data arrives), and applies a shared set of
 * dark-theme defaults. SSR-safe: the chart is only initialised on the browser.
 */
@Component({
  selector: 'app-apex-chart',
  standalone: true,
  imports: [],
  template: `<div #chartHost class="w-full h-full min-h-[180px]"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApexChartComponent implements OnInit, OnDestroy {
  readonly chartConfig = input<ApexOptions>({});
  readonly height = input<number | string>(280);
  readonly container = viewChild<ElementRef<HTMLDivElement>>('chartHost');

  private readonly chart = signal<ApexCharts | null>(null);

  constructor() {
    effect(() => {
      const cfg = this.chartConfig();
      const el = this.container();
      const height = this.height();
      if (el && cfg && typeof window !== 'undefined') {
        this.chart()?.destroy();
        const chart = new ApexCharts(el.nativeElement, {
          chart: {
            height,
            fontFamily: 'Inter, system-ui, sans-serif',
            foreColor: '#a3a1b8',
            toolbar: { show: false },
            animations: { enabled: true, speed: 500 },
            background: 'transparent',
            ...(cfg.chart ?? {}),
          },
          ...cfg,
        } as ApexOptions);
        this.chart.set(chart);
        void chart.render();
      }
    });
  }

  ngOnInit(): void {
    if (typeof window === 'undefined') return;
    this.container()?.nativeElement.setAttribute('role', 'img');
  }

  ngOnDestroy(): void {
    this.chart()?.destroy();
    this.chart.set(null);
  }
}
