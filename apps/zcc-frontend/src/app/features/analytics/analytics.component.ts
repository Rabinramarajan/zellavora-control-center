import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PermissionService } from '../../core/rbac/services/permission.service';
import {
  AnalyticsDailyPoint,
  AnalyticsMetric,
  AnalyticsRange,
} from '../../shared/models/analytics.model';
import { EmptyStateComponent } from '../../shared/components/iam';
import { FilterChipOption, FilterChipsComponent } from '../../shared/components/filter-chips';
import { IAM_BTN, IAM_CARD, IamPageHeaderComponent } from '../iam/shared/iam-page-header.component';
import { IamFeedbackService } from '../iam/shared/iam-feedback.service';
import { formatDate } from '../iam/shared/iam-format';
import { TrendChartComponent, TrendSeries } from '../dashboard/components/trend-chart.component';
import { RankedListComponent } from './components/ranked-list.component';
import { AnalyticsStore } from './analytics.store';

type KpiFormat = 'number' | 'percent' | 'duration';

interface KpiTile {
  key: string;
  label: string;
  icon: string;
  metric: AnalyticsMetric;
  format: KpiFormat;
  hint: string;
}

interface DeviceRow {
  key: string;
  label: string;
  icon: string;
  count: number;
  share: number;
  color: string;
}

const RANGE_CHIPS: FilterChipOption<AnalyticsRange>[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

/** Chart colours chosen to stay distinguishable on both the light and dark surfaces. */
const COLORS = { views: '#6366f1', visitors: '#0ea5e9', sessions: '#10b981' } as const;

@Component({
  selector: 'app-analytics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    EmptyStateComponent,
    FilterChipsComponent,
    IamPageHeaderComponent,
    TrendChartComponent,
    RankedListComponent,
  ],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
})
export class AnalyticsComponent {
  protected readonly store = inject(AnalyticsStore);
  private readonly feedback = inject(IamFeedbackService);
  protected readonly canExport = inject(PermissionService).can('analytics:export');

  protected readonly btn = IAM_BTN;
  protected readonly card = IAM_CARD;
  protected readonly rangeChips = RANGE_CHIPS;
  protected readonly colors = COLORS;
  protected readonly showTrafficTable = signal(false);

  protected readonly periodLabel = computed(() => {
    const o = this.store.overview();
    if (!o) return '';
    return `${formatDate(o.range.from)} – ${formatDate(o.range.to)} · compared with the previous ${o.range.days} days`;
  });

  protected readonly kpis = computed<KpiTile[]>(() => {
    const k = this.store.overview()?.kpis;
    if (!k) return [];
    return [
      {
        key: 'views',
        label: 'Page Views',
        icon: 'pi pi-eye',
        metric: k.pageViews,
        format: 'number',
        hint: 'Screens opened',
      },
      {
        key: 'visitors',
        label: 'Unique Visitors',
        icon: 'pi pi-users',
        metric: k.uniqueVisitors,
        format: 'number',
        hint: 'Distinct browsers',
      },
      {
        key: 'sessions',
        label: 'Sessions',
        icon: 'pi pi-clone',
        metric: k.sessions,
        format: 'number',
        hint: 'Visits, ending after 30 min idle',
      },
      {
        key: 'engagement',
        label: 'Engagement Rate',
        icon: 'pi pi-bolt',
        metric: k.engagementRate,
        format: 'percent',
        hint: 'Sessions with 2+ pages or 30s+',
      },
      {
        key: 'duration',
        label: 'Avg. Session',
        icon: 'pi pi-clock',
        metric: k.avgSessionSeconds,
        format: 'duration',
        hint: 'Time from first to last page',
      },
    ];
  });

  protected readonly daily = computed<AnalyticsDailyPoint[]>(
    () => this.store.overview()?.daily ?? []
  );
  protected readonly dates = computed(() => this.daily().map((d) => d.date));

  protected readonly trafficSeries = computed<TrendSeries[]>(() => [
    { name: 'Page views', color: COLORS.views, data: this.daily().map((d) => d.pageViews) },
    { name: 'Visitors', color: COLORS.visitors, data: this.daily().map((d) => d.uniqueVisitors) },
  ]);

  protected readonly sessionSeries = computed<TrendSeries[]>(() => [
    { name: 'Sessions', color: COLORS.sessions, data: this.daily().map((d) => d.sessions) },
  ]);

  protected readonly devices = computed<DeviceRow[]>(() => {
    const d = this.store.overview()?.deviceBreakdown;
    if (!d) return [];
    const total = d.desktop + d.mobile + d.tablet;
    const share = (n: number): number => (total ? Math.round((n / total) * 100) : 0);
    return [
      {
        key: 'desktop',
        label: 'Desktop',
        icon: 'pi pi-desktop',
        count: d.desktop,
        color: COLORS.views,
      },
      {
        key: 'mobile',
        label: 'Mobile',
        icon: 'pi pi-mobile',
        count: d.mobile,
        color: COLORS.visitors,
      },
      {
        key: 'tablet',
        label: 'Tablet',
        icon: 'pi pi-tablet',
        count: d.tablet,
        color: COLORS.sessions,
      },
    ].map((r) => ({ ...r, share: share(r.count) }));
  });
  protected readonly deviceTotal = computed(() =>
    this.devices().reduce((sum, d) => sum + d.count, 0)
  );

  public constructor() {
    void this.store.load();
  }

  protected onRange(range: AnalyticsRange | null | undefined): void {
    if (range) this.store.setRange(range);
  }

  protected async exportCsv(): Promise<void> {
    if (await this.store.exportCsv()) this.feedback.success('Analytics report downloaded.');
    else this.feedback.error(null, 'Could not export the analytics report.');
  }

  protected formatValue(value: number, format: KpiFormat): string {
    if (format === 'percent')
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
    if (format === 'duration') return this.duration(value);
    return value.toLocaleString();
  }

  /** Wording for screen readers and the tooltip, e.g. "Up 12.5% from 1,204". */
  protected changeLabel(tile: KpiTile): string {
    const { change, previous } = tile.metric;
    const before = this.formatValue(previous, tile.format);
    if (change === null) return `No data in the previous period`;
    if (change === 0) return `No change from ${before}`;
    return `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)}% from ${before}`;
  }

  protected longDate(iso: string): string {
    return formatDate(iso);
  }

  private duration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
  }
}
