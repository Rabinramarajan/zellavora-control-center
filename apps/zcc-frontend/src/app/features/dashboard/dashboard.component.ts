import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SelectControl } from '@zellavoras/ui';
import { AuthStore } from '../../core/auth/auth.store';
import {
  PageChangeEvent,
  PaginationComponent,
} from '../../shared/components/pagination/pagination.component';
import { CsvExporter } from '../../shared/utils/csv-exporter';
import { DashboardStore } from './dashboard.store';
import { ActivityEvent, AuditSeverity, DashboardRange, TrendPoint } from './dashboard.models';
import { KpiCardComponent, KpiTone } from './components/kpi-card.component';
import { TrendChartComponent, TrendSeries } from './components/trend-chart.component';
import { PlanDonutComponent } from './components/plan-donut.component';
import { DashboardIconComponent, DashboardIconName } from './components/dashboard-icon.component';

// '' is the 'no filter' sentinel: it must stay distinct from 'info', otherwise
// the Info option is unselectable and @for sees duplicate track keys (NG0955).
const SEVERITY_OPTIONS: Array<{ label: string; value: AuditSeverity | '' }> = [
  { label: 'All severities', value: '' },
  { label: 'Debug', value: 'debug' },
  { label: 'Info', value: 'info' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' },
  { label: 'Critical', value: 'critical' },
];

const PAGE_SIZE_OPTIONS = [8, 15, 25, 50];

const RANGES: DashboardRange[] = ['7', '30', '90'];

interface KpiView {
  label: string;
  value: number;
  hint: string;
  icon: DashboardIconName;
  tone: KpiTone;
  delta: number | null;
  series: number[];
}

interface QuickAction {
  title: string;
  subtitle: string;
  icon: DashboardIconName;
  tone: KpiTone;
  link: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    title: 'Create Sheet',
    subtitle: 'Add new daily sheet',
    icon: 'sheet',
    tone: 'purple',
    link: '/freelancer-sheets/daily/new',
  },
  {
    title: 'Invite Member',
    subtitle: 'Add team member',
    icon: 'user-plus',
    tone: 'blue',
    link: '/iam/user-requests/create',
  },
  {
    title: 'Upload Media',
    subtitle: 'Add files to gallery',
    icon: 'upload',
    tone: 'emerald',
    link: '/media',
  },
  {
    title: 'Manage Projects',
    subtitle: 'View all projects',
    icon: 'folder',
    tone: 'amber',
    link: '/projects',
  },
  {
    title: 'View Reports',
    subtitle: 'Analytics & insights',
    icon: 'chart',
    tone: 'pink',
    link: '/analytics',
  },
  {
    title: 'Settings',
    subtitle: 'Workspace settings',
    icon: 'settings',
    tone: 'purple',
    link: '/settings',
  },
];

/** Presentation for each KPI key the API can return, across both scopes. */
const KPI_STYLES: Record<string, { icon: DashboardIconName; tone: KpiTone }> = {
  organizations: { icon: 'building', tone: 'purple' },
  members: { icon: 'users', tone: 'blue' },
  projects: { icon: 'folder', tone: 'purple' },
  sheets: { icon: 'sheet', tone: 'blue' },
  mediaFiles: { icon: 'upload', tone: 'amber' },
  activeSessions: { icon: 'bolt', tone: 'emerald' },
  pendingInvitations: { icon: 'mail', tone: 'amber' },
  auditEvents24h: { icon: 'file', tone: 'pink' },
  criticalAlerts24h: { icon: 'siren', tone: 'red' },
};

const KPI_STYLE_FALLBACK: { icon: DashboardIconName; tone: KpiTone } = {
  icon: 'file',
  tone: 'purple',
};

// Individual accounts hold no IAM or workspace-settings permissions, so these
// tiles would only lead to a 403.
const INDIVIDUAL_HIDDEN_ACTIONS = new Set(['Invite Member', 'Settings']);

const SEVERITY_TONE: Record<AuditSeverity, string> = {
  debug: 'bg-slate-500/15 text-slate-300 ring-slate-400/20',
  info: 'bg-blue-500/15 text-blue-300 ring-blue-400/25',
  warning: 'bg-amber-500/15 text-amber-300 ring-amber-400/25',
  error: 'bg-rose-500/15 text-rose-300 ring-rose-400/25',
  critical: 'bg-red-600/20 text-red-300 ring-red-500/30',
};

/** Percent change of the later half of a series against the earlier half. */
function halfOverHalf(points: TrendPoint[] | undefined): number | null {
  if (!points?.length) return null;
  const mid = Math.floor(points.length / 2);
  const sum = (arr: TrendPoint[]) => arr.reduce((a, p) => a + p.count, 0);
  const before = sum(points.slice(0, mid));
  const after = sum(points.slice(mid));
  if (before === 0) return after === 0 ? 0 : 100;
  return ((after - before) / before) * 100;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    SelectControl,
    KpiCardComponent,
    TrendChartComponent,
    PlanDonutComponent,
    DashboardIconComponent,
    PaginationComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  readonly store = inject(DashboardStore);
  private readonly auth = inject(AuthStore);

  readonly ranges = RANGES;
  readonly severityOptions = SEVERITY_OPTIONS;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  readonly firstName = computed(() => this.auth.user()?.fullName?.trim().split(/\s+/)[0] ?? '');

  /**
   * The API decides which KPIs apply to the caller's scope; the client only
   * supplies presentation. Unknown keys fall back to a neutral style rather
   * than dropping the card.
   */
  readonly kpiCards = computed<KpiView[]>(() =>
    this.store.kpis().map((k) => {
      const style = KPI_STYLES[k.key] ?? KPI_STYLE_FALLBACK;
      return {
        label: k.label,
        value: k.value,
        hint: k.hint,
        icon: style.icon,
        tone: style.tone,
        delta: k.series ? halfOverHalf(this.store.pointsFor(k.series)) : null,
        series: this.store.seriesFor(k.series),
      };
    })
  );

  readonly hasTrendData = computed(() => (this.store.trends()?.activity.length ?? 0) > 0);

  readonly trendDates = computed(() => this.store.trends()?.activity.map((p) => p.date) ?? []);

  readonly trendSeries = computed<TrendSeries[]>(() => [
    { name: 'Activity', color: '#a855f7', data: this.store.activitySeries() },
    {
      name: this.store.trendLegend().secondary,
      color: '#3b82f6',
      data: this.store.secondarySeries(),
    },
  ]);

  readonly isIndividual = computed(() => this.store.scope() === 'individual');

  readonly trendSubtitle = computed(() =>
    this.isIndividual()
      ? 'Your activity and daily sheets over time.'
      : 'Audit activity and member sign-ups over time.'
  );

  /** Org-only destinations are dropped for personal accounts that cannot reach them. */
  readonly visibleQuickActions = computed(() =>
    this.isIndividual()
      ? QUICK_ACTIONS.filter((a) => !INDIVIDUAL_HIDDEN_ACTIONS.has(a.title))
      : QUICK_ACTIONS
  );

  readonly rangeStart = computed(() => {
    const a = this.store.activity();
    return a && a.total ? (a.page - 1) * this.store.activityPageSize() + 1 : 0;
  });

  readonly rangeEnd = computed(() => {
    const a = this.store.activity();
    return a ? Math.min(a.total, this.rangeStart() + a.items.length - 1) : 0;
  });

  ngOnInit(): void {
    if (this.store.isStale()) {
      void this.store.loadOverview();
      void this.store.loadActivity(1);
    }
  }

  setRangeValue(value: string): void {
    this.store.setRange(value as DashboardRange);
  }

  applySeverityFilter(value: string): void {
    this.store.setActivityFilters(value === '' ? {} : { severity: value as AuditSeverity });
  }

  onPaginate({ page, pageSize }: PageChangeEvent): void {
    if (pageSize !== this.store.activityPageSize()) this.store.setActivityPageSize(pageSize);
    else void this.store.loadActivity(page);
  }

  severityClass(severity: AuditSeverity): string {
    return SEVERITY_TONE[severity];
  }

  activityIcon(event: ActivityEvent): { icon: DashboardIconName; tone: KpiTone } {
    const action = event.action.toLowerCase();
    if (event.severity === 'critical' || event.severity === 'error')
      return { icon: 'alert', tone: 'red' };
    if (action.includes('logout')) return { icon: 'logout', tone: 'red' };
    if (action.includes('login')) return { icon: 'login', tone: 'blue' };
    if (action.includes('update') || action.includes('edit'))
      return { icon: 'edit', tone: 'emerald' };
    if (action.includes('invite')) return { icon: 'mail', tone: 'amber' };
    if (action.includes('role') || action.includes('permission'))
      return { icon: 'shield', tone: 'purple' };
    return { icon: 'file', tone: 'pink' };
  }

  activityTitle(event: ActivityEvent): string {
    const words = event.action.replace(/[_.-]+/g, ' ').trim();
    const sentence = /^user\b/i.test(words) ? words : `User ${words}`;
    return this.pastTense(sentence.charAt(0).toUpperCase() + sentence.slice(1));
  }

  relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.round(diff / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }

  exportActivityCsv(): void {
    const rows = this.store.activity()?.items ?? [];
    CsvExporter.export(
      `zcc-activity-${new Date().toISOString().slice(0, 10)}`,
      ['Timestamp', 'Actor', 'Action', 'Resource', 'Severity'],
      rows.map((e) => [
        e.createdAt,
        e.actorEmail ?? 'system',
        e.action,
        e.resource ?? '',
        e.severity,
      ])
    );
  }

  exportOverviewCsv(): void {
    const overview = this.store.overview();
    if (!overview) return;
    CsvExporter.export(
      `zcc-overview-${new Date().toISOString().slice(0, 10)}`,
      ['Metric', 'Value'],
      this.kpiCards().map((c) => [c.label, c.value])
    );
  }

  // Audit actions arrive as bare verbs ("login"); the feed reads better in past tense.
  private pastTense(text: string): string {
    return text
      .replace(/\blogin\b/i, 'logged in')
      .replace(/\blogout\b/i, 'logged out')
      .replace(/\b(create|update|delete|invite|approve|reject)\b/i, (m) => `${m}d`);
  }
}
