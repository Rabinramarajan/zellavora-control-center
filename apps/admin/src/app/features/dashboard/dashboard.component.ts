import { Component, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardStore } from './dashboard.store';
import { DashboardApiService } from './dashboard.api';
import { DashboardRange, DashboardOverview, AuditSeverity } from './dashboard.models';
import { KpiCardComponent } from './components/kpi-card/kpi-card.component';
import { ActivityFeedComponent } from './components/activity-feed/activity-feed.component';
import { SkeletonCardComponent } from './components/skeletons/skeleton-block.component';
import { DashboardEmptyComponent, DashboardErrorComponent } from './components/states/dashboard-states.component';
import { ApexChartComponent } from '@shared/components/apex-chart/apex-chart.component';
import { CsvExporter } from '@shared/utils/csv-exporter';

const SEVERITY_OPTIONS: Array<{ label: string; value: AuditSeverity }> = [
  { label: 'All severities', value: 'info' },
  { label: 'Debug', value: 'debug' },
  { label: 'Info', value: 'info' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' },
  { label: 'Critical', value: 'critical' },
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    KpiCardComponent,
    ActivityFeedComponent,
    SkeletonCardComponent,
    DashboardEmptyComponent,
    DashboardErrorComponent,
    ApexChartComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  readonly store = inject(DashboardStore);

  readonly severityOptions = SEVERITY_OPTIONS;

  readonly Math = Math;

  severityClass(severity: AuditSeverity): string {
    const tones: Record<AuditSeverity, string> = {
      debug: 'bg-slate-500/10 text-slate-400',
      info: 'bg-blue-500/10 text-blue-400',
      warning: 'bg-amber-500/10 text-amber-400',
      error: 'bg-red-500/10 text-red-400',
      critical: 'bg-rose-500/10 text-rose-400',
    };
    return tones[severity];
  }

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  readonly trendChartConfig = computed(() => ({
    chart: { type: 'area' as const, stacked: false, zoom: { enabled: false } },
    series: [
      {
        name: 'Activity',
        data: this.store.activitySeries(),
      },
      {
        name: 'Members',
        data: this.store.membersSeries(),
      },
    ],
    colors: ['#a855f7', '#3b82f6'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth' as const, width: 2.5 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.25, opacityTo: 0.02 } },
    grid: { borderColor: '#13112b' },
    xaxis: { categories: this.store.trendLabels(), labels: { style: { colors: '#a3a1b8' } } },
    yaxis: { labels: { style: { colors: '#a3a1b8' } } },
    legend: { labels: { colors: '#a3a1b8' }, position: 'top' as const },
    tooltip: { theme: 'dark' as const },
  }));

  readonly planChartConfig = computed(() => ({
    chart: { type: 'donut' as const },
    series: this.store.planDistribution().map((p) => p.count),
    labels: this.store.planDistribution().map((p) => this.planLabel(p.plan)),
    colors: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
    legend: { labels: { colors: '#a3a1b8' }, position: 'bottom' as const },
    dataLabels: { enabled: false },
    tooltip: { theme: 'dark' as const },
  }));

  ngOnInit(): void {
    if (this.store.isStale()) {
      void this.store.loadOverview();
      void this.store.loadActivity(1);
    }
  }

  setRange(range: DashboardRange): void {
    this.store.setRange(range);
  }

  /** Template helper — string literal from the template cast to DashboardRange. */
  setRangeValue(value: string): void {
    this.setRange(value as DashboardRange);
  }

  readonly hasTrendData = computed(() => (this.store.trends()?.activity.length ?? 0) > 0);

  applySeverityFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as AuditSeverity;
    this.store.setActivityFilters(
      value === 'info' ? {} : { severity: value }
    );
  }

  exportActivityCsv(): void {
    const rows = this.store.activity()?.items ?? [];
    CsvExporter.export(
      `zcc-activity-${new Date().toISOString().slice(0, 10)}`,
      ['Timestamp', 'Actor', 'Action', 'Resource', 'Severity'],
      rows.map((e) => [e.createdAt, e.actorEmail ?? 'system', e.action, e.resource ?? '', e.severity])
    );
  }

  exportOverviewCsv(): void {
    const overview = this.store.overview();
    if (!overview) return;
    CsvExporter.export(
      `zcc-overview-${new Date().toISOString().slice(0, 10)}`,
      ['Metric', 'Value'],
      [
        ['Organizations', overview.kpis.organizations],
        ['Members', overview.kpis.members],
        ['Active sessions', overview.kpis.activeSessions],
        ['Pending invitations', overview.kpis.pendingInvitations],
        ['Audit events (24h)', overview.kpis.auditEvents24h],
        ['Critical alerts (24h)', overview.kpis.criticalAlerts24h],
      ]
    );
  }

  printDashboard(): void {
    window.print();
  }

  private planLabel(plan: string): string {
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  }
}
