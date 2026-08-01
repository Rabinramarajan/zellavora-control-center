import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { DashboardApiService } from './dashboard.api';
import {
  ActivityEvent,
  ActivityFeedFilters,
  ActivityFeedPage,
  DashboardOverview,
  DashboardRange,
} from './dashboard.models';

export interface DashboardStoreState {
  range: DashboardRange;
  overview: DashboardOverview | null;
  activity: ActivityFeedPage | null;
  activityFilters: ActivityFeedFilters;

  loadingOverview: boolean;
  loadingActivity: boolean;
  errorOverview: string | null;
  errorActivity: string | null;

  lastOverviewLoad: number | null;
}

const initial: DashboardStoreState = {
  range: '30',
  overview: null,
  activity: null,
  activityFilters: {},

  loadingOverview: false,
  loadingActivity: false,
  errorOverview: null,
  errorActivity: null,

  lastOverviewLoad: null,
};

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly api = inject(DashboardApiService);
  private readonly state = signal<DashboardStoreState>(initial);

  // --- Selectors ------------------------------------------------------------
  readonly range = computed(() => this.state().range);
  readonly overview = computed(() => this.state().overview);
  readonly activity = computed(() => this.state().activity);
  readonly activityFilters = computed(() => this.state().activityFilters);

  readonly loadingOverview = computed(() => this.state().loadingOverview);
  readonly loadingActivity = computed(() => this.state().loadingActivity);
  readonly errorOverview = computed(() => this.state().errorOverview);
  readonly errorActivity = computed(() => this.state().errorActivity);

  readonly hasOverview = computed(() => this.state().overview !== null);
  readonly isStale = computed(() => {
    const t = this.state().lastOverviewLoad;
    return t === null || Date.now() - t > 5 * 60 * 1000;
  });

  readonly kpis = computed(() => this.state().overview?.kpis ?? null);
  readonly trends = computed(() => this.state().overview?.trends ?? null);
  readonly recentActivity = computed(() => this.state().overview?.activity ?? []);
  readonly planDistribution = computed(() => this.state().overview?.planDistribution ?? []);

  // Derived chart-ready series
  readonly trendLabels = computed(() => {
    const t = this.trends();
    return t?.activity.map((p) => this.formatLabel(p.date)) ?? [];
  });
  readonly activitySeries = computed(() => this.trends()?.activity.map((p) => p.count) ?? []);
  readonly membersSeries = computed(() => this.trends()?.members.map((p) => p.count) ?? []);
  readonly orgsSeries = computed(() => this.trends()?.organizations.map((p) => p.count) ?? []);

  // --- Actions --------------------------------------------------------------
  setRange(range: DashboardRange): void {
    this.state.update((s) => ({ ...s, range }));
    void this.loadOverview(range);
  }

  loadOverview(range: DashboardRange = this.state().range): Promise<void> {
    this.state.update((s) => ({ ...s, loadingOverview: true, errorOverview: null }));
    return new Promise<void>((resolve) => {
      this.api.getOverview(range).subscribe({
        next: (res) => {
          this.state.update((s) => ({
            ...s,
            overview: res.data,
            loadingOverview: false,
            lastOverviewLoad: Date.now(),
          }));
          resolve();
        },
        error: (err) => {
          const message =
            err?.error?.error?.message ?? 'Unable to load the dashboard overview.';
          this.state.update((s) => ({
            ...s,
            loadingOverview: false,
            errorOverview: message,
          }));
          resolve();
        },
      });
    });
  }

  setActivityFilters(filters: ActivityFeedFilters): void {
    this.state.update((s) => ({ ...s, activityFilters: filters }));
    void this.loadActivity(1);
  }

  loadActivity(page: number = this.state().activity?.page ?? 1): Promise<void> {
    const { range, activityFilters } = this.state();
    this.state.update((s) => ({ ...s, loadingActivity: true, errorActivity: null }));
    return new Promise<void>((resolve) => {
      this.api
        .getActivityFeed(range, page, 20, activityFilters)
        .pipe(finalize(() => resolve()))
        .subscribe({
          next: (res) =>
            this.state.update((s) => ({
              ...s,
              activity: res.data,
              loadingActivity: false,
            })),
          error: (err) => {
            const message =
              err?.error?.error?.message ?? 'Unable to load the activity feed.';
            this.state.update((s) => ({
              ...s,
              loadingActivity: false,
              errorActivity: message,
            }));
          },
        });
    });
  }

  refreshAll(): void {
    void this.loadOverview(this.state().range);
    void this.loadActivity(this.state().activity?.page ?? 1);
  }

  reset(): void {
    this.state.set(initial);
  }

  // --- Helpers --------------------------------------------------------------
  private formatLabel(iso: string): string {
    const d = new Date(`${iso}T00:00:00Z`);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}

export type { ActivityEvent };
