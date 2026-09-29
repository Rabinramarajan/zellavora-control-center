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
import type ApexCharts from 'apexcharts';
import type { ApexOptions } from 'apexcharts';

/**
 * Lightweight, framework-neutral ApexCharts wrapper.
 *
 * Accepts a signal input (`chartConfig`) so the chart is rebuilt whenever the
 * config changes (e.g. after new data arrives), and applies a shared set of
 * dark-theme defaults. SSR-safe: the chart is only initialised on the browser.
 *
 * ApexCharts (~500 KB with its SVG engine) is pulled in via dynamic `import()`
 * so it lands in its own chunk and is fetched only when a chart is actually
 * rendered, instead of being linked into the chunk of every page that happens
 * to embed this component.
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

  /** Module promise, created once and shared by every instance. */
  private static apexModule?: Promise<typeof ApexCharts>;

  /**
   * Incremented on every render request. An async render that finishes after a
   * newer one started is stale and must throw away the chart it built, or the
   * host ends up with two overlapping charts.
   */
  private renderToken = 0;

  private destroyed = false;

  constructor() {
    effect(() => {
      const cfg = this.chartConfig();
      const el = this.container();
      const height = this.height();
      if (!el || !cfg || typeof window === 'undefined') return;
      void this.render(el.nativeElement, cfg, height);
    });
  }

  private async render(
    host: HTMLElement,
    cfg: ApexOptions,
    height: number | string
  ): Promise<void> {
    const token = ++this.renderToken;

    ApexChartComponent.apexModule ??= import('apexcharts').then((m) => m.default);
    const ApexChartsCtor = await ApexChartComponent.apexModule;

    if (this.destroyed || token !== this.renderToken) return;

    this.chart()?.destroy();
    const chart = new ApexChartsCtor(host, {
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
    await chart.render();
  }

  ngOnInit(): void {
    if (typeof window === 'undefined') return;
    this.container()?.nativeElement.setAttribute('role', 'img');
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.chart()?.destroy();
    this.chart.set(null);
  }
}
