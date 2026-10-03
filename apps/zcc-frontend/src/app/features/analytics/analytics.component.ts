import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SelectControl } from '@zellavoras/ui';
import { AuthStore } from '../../core/auth/auth.store';
import { CsvExporter } from '../../shared/utils/csv-exporter';
import { AnalyticsStore } from './analytics.store';
import { AnalyticsRange, AnalyticsTrendPoint } from './analytics.models';
import { KpiCardComponent, KpiTone } from './components/kpi-card.component';
import { TrendChartComponent, TrendSeries } from '../dashboard/components/trend-chart.component';
import { BarChartComponent, BarSeries } from './components/bar-chart.component';
import { DonutChartComponent, DonutSlice } from './components/donut-chart.component';

const RANGES: AnalyticsRange[] = ['7', '30', '90'];

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  7: 'Last 7 days',
  30: 'Last 30 days',
  90: 'Last 90 days',
};

interface KpiView {
  label: string;
  value: number | string;
  hint: string;
  icon: string;
  tone: KpiTone;
  delta: number | null;
  series: number[];
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    SelectControl,
    KpiCardComponent,
    TrendChartComponent,
    BarChartComponent,
    DonutChartComponent,
  ],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
})
export class AnalyticsComponent implements OnInit {
  readonly store = inject(AnalyticsStore);
  private readonly auth = inject(AuthStore);

  readonly ranges = RANGES;
  readonly rangeLabels = RANGE_LABELS;

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  readonly firstName = computed(() => this.auth.user()?.fullName?.trim().split(/\s+/)[0] ?? '');

  readonly kpiCards = computed<KpiView[]>(() => {
    const k = this.store.kpis();
    if (!k) return [];
    return [
      {
        label: 'Total Page Views',
        value: k.pageViews.toLocaleString(),
        hint: 'All page views',
        icon: 'pi pi-eye',
        tone: 'purple',
        delta: this.halfOverHalf(this.store.pageViewsTrend()),
        series: this.store.pageViewsSeries(),
      },
      {
        label: 'Unique Visitors',
        value: k.uniqueVisitors.toLocaleString(),
        hint: 'Distinct visitors',
        icon: 'pi pi-users',
        tone: 'blue',
        delta: this.halfOverHalf(this.store.uniqueVisitorsTrend()),
        series: this.store.uniqueVisitorsSeries(),
      },
      {
        label: 'Engagement Rate',
        value: `${k.engagementRate}%`,
        hint: 'Engaged sessions',
        icon: 'pi pi-chart-line',
        tone: 'emerald',
        delta: this.halfOverHalf(this.store.engagementTrend()),
        series: this.store.engagementSeries(),
      },
      {
        label: 'Project Views',
        value: k.projectViews.toLocaleString(),
        hint: 'Projects section',
        icon: 'pi pi-folder',
        tone: 'amber',
        delta: null,
        series: [],
      },
      {
        label: 'Blog Views',
        value: k.blogViews.toLocaleString(),
        hint: 'Blog section',
        icon: 'pi pi-file',
        tone: 'pink',
        delta: null,
        series: [],
      },
    ];
  });

  readonly hasTrendData = computed(() => (this.store.pageViewsTrend().length ?? 0) > 0);

  readonly trendDates = computed(() => this.store.trendLabels());

  readonly trendSeries = computed<TrendSeries[]>(() => [
    { name: 'Page Views', color: '#a855f7', data: this.store.pageViewsSeries() },
    { name: 'Unique Visitors', color: '#3b82f6', data: this.store.uniqueVisitorsSeries() },
    { name: 'Engagement', color: '#10b981', data: this.store.engagementSeries() },
  ]);

  readonly deviceDonut = computed<DonutSlice[]>(() => {
    const d = this.store.deviceBreakdown();
    if (!d) return [];
    const total = d.desktop + d.mobile + d.tablet;
    if (total === 0) return [];
    return [
      { name: 'Desktop', value: d.desktop, color: '#3b82f6' },
      { name: 'Mobile', value: d.mobile, color: '#a855f7' },
      { name: 'Tablet', value: d.tablet, color: '#10b981' },
    ];
  });

  readonly topPagesBar = computed<BarSeries[]>(() => {
    const items = this.store.topPages();
    if (!items.length) return [];
    return [
      {
        name: 'Views',
        color: '#a855f7',
        data: items.map((i) => i.count),
      },
    ];
  });

  readonly topPagesLabels = computed(() =>
    this.store.topPages().map((i) => this.truncatePath(i.name, 25))
  );

  readonly topReferrersBar = computed<BarSeries[]>(() => {
    const items = this.store.topReferrers();
    if (!items.length) return [];
    return [
      {
        name: 'Visits',
        color: '#3b82f6',
        data: items.map((i) => i.count),
      },
    ];
  });

  readonly topReferrersLabels = computed(() => this.store.topReferrers().map((i) => i.name));

  readonly topCountriesBar = computed<BarSeries[]>(() => {
    const items = this.store.topCountries();
    if (!items.length) return [];
    return [
      {
        name: 'Visits',
        color: '#10b981',
        data: items.map((i) => i.count),
      },
    ];
  });

  readonly topCountriesLabels = computed(() => this.store.topCountries().map((i) => i.name));

  readonly topBrowsersBar = computed<BarSeries[]>(() => {
    const items = this.store.topBrowsers();
    if (!items.length) return [];
    return [
      {
        name: 'Visits',
        color: '#f59e0b',
        data: items.map((i) => i.count),
      },
    ];
  });

  readonly topBrowsersLabels = computed(() => this.store.topBrowsers().map((i) => i.name));

  ngOnInit(): void {
    if (this.store.isStale()) {
      void this.store.loadOverview();
      void this.store.loadDetails();
    }
  }

  setRangeValue(value: string): void {
    this.store.setRange(value as AnalyticsRange);
  }

  exportCsv(): void {
    const overview = this.store.overview();
    if (!overview) return;

    const rows: string[][] = [
      ['Metric', 'Value'],
      ['Generated At', overview.generatedAt],
      ['Page Views', overview.kpis.pageViews.toString()],
      ['Unique Visitors', overview.kpis.uniqueVisitors.toString()],
      ['Engagement Rate', `${overview.kpis.engagementRate}%`],
      ['Project Views', overview.kpis.projectViews.toString()],
      ['Blog Views', overview.kpis.blogViews.toString()],
      ['', ''],
      ['Top Pages', '', 'Views', 'Percentage'],
      ...overview.topPages.map((p) => ['', p.name, p.count.toString(), `${p.percentage}%`]),
      ['', ''],
      ['Top Referrers', '', 'Visits', 'Percentage'],
      ...overview.topReferrers.map((p) => ['', p.name, p.count.toString(), `${p.percentage}%`]),
      ['', ''],
      ['Top Countries', '', 'Visits', 'Percentage'],
      ...overview.topCountries.map((p) => ['', p.name, p.count.toString(), `${p.percentage}%`]),
      ['', ''],
      ['Device Breakdown', '', 'Views'],
      ['', 'Desktop', overview.deviceBreakdown.desktop.toString()],
      ['', 'Mobile', overview.deviceBreakdown.mobile.toString()],
      ['', 'Tablet', overview.deviceBreakdown.tablet.toString()],
      ['', ''],
      ['Top Browsers', '', 'Visits', 'Percentage'],
      ...overview.topBrowsers.map((p) => ['', p.name, p.count.toString(), `${p.percentage}%`]),
      ['', ''],
      ['Top OS', '', 'Visits', 'Percentage'],
      ...overview.topOS.map((p) => ['', p.name, p.count.toString(), `${p.percentage}%`]),
    ];

    CsvExporter.export(
      `zcc-analytics-${this.store.range()}d-${new Date().toISOString().slice(0, 10)}`,
      rows[0],
      rows.slice(1)
    );
  }

  /** Percent change of the later half of a series against the earlier half. */
  private halfOverHalf(points: AnalyticsTrendPoint[] | undefined): number | null {
    if (!points?.length) return null;
    const mid = Math.floor(points.length / 2);
    const sum = (arr: AnalyticsTrendPoint[]) => arr.reduce((a, p) => a + p.count, 0);
    const before = sum(points.slice(0, mid));
    const after = sum(points.slice(mid));
    if (before === 0) return after === 0 ? 0 : 100;
    return ((after - before) / before) * 100;
  }

  private truncatePath(path: string, maxLen: number): string {
    if (path.length <= maxLen) return path;
    return '…' + path.slice(-maxLen + 1);
  }
}
