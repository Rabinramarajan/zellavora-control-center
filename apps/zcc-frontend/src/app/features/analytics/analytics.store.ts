import { Injectable, computed, inject, signal } from '@angular/core';
import { AnalyticsApiService } from './analytics.api';
import {
  AnalyticsOverview,
  AnalyticsTopItem,
  AnalyticsDeviceBreakdown,
  AnalyticsRange,
} from './analytics.models';

export interface AnalyticsStoreState {
  range: AnalyticsRange;
  overview: AnalyticsOverview | null;
  loadingOverview: boolean;
  errorOverview: string | null;
  lastOverviewLoad: number | null;

  topPages: AnalyticsTopItem[];
  topReferrers: AnalyticsTopItem[];
  topCountries: AnalyticsTopItem[];
  topCities: AnalyticsTopItem[];
  deviceBreakdown: AnalyticsDeviceBreakdown | null;
  topBrowsers: AnalyticsTopItem[];
  topOS: AnalyticsTopItem[];
  loadingDetails: boolean;
  errorDetails: string | null;
}

const initial: AnalyticsStoreState = {
  range: '30',
  overview: null,
  loadingOverview: false,
  errorOverview: null,
  lastOverviewLoad: null,

  topPages: [],
  topReferrers: [],
  topCountries: [],
  topCities: [],
  deviceBreakdown: null,
  topBrowsers: [],
  topOS: [],
  loadingDetails: false,
  errorDetails: null,
};

@Injectable({ providedIn: 'root' })
export class AnalyticsStore {
  private readonly api = inject(AnalyticsApiService);
  private readonly state = signal<AnalyticsStoreState>(initial);

  // --- Selectors ------------------------------------------------------------
  readonly range = computed(() => this.state().range);
  readonly overview = computed(() => this.state().overview);
  readonly loadingOverview = computed(() => this.state().loadingOverview);
  readonly errorOverview = computed(() => this.state().errorOverview);

  readonly topPages = computed(() => this.state().topPages);
  readonly topReferrers = computed(() => this.state().topReferrers);
  readonly topCountries = computed(() => this.state().topCountries);
  readonly topCities = computed(() => this.state().topCities);
  readonly deviceBreakdown = computed(() => this.state().deviceBreakdown);
  readonly topBrowsers = computed(() => this.state().topBrowsers);
  readonly topOS = computed(() => this.state().topOS);
  readonly loadingDetails = computed(() => this.state().loadingDetails);
  readonly errorDetails = computed(() => this.state().errorDetails);

  // KPIs
  readonly kpis = computed(() => this.state().overview?.kpis ?? null);

  // Trends
  readonly trends = computed(() => this.state().overview?.trends ?? null);
  readonly pageViewsTrend = computed(() => this.state().overview?.trends.pageViews ?? []);
  readonly uniqueVisitorsTrend = computed(() => this.state().overview?.trends.uniqueVisitors ?? []);
  readonly engagementTrend = computed(() => this.state().overview?.trends.engagement ?? []);

  // Chart-ready series
  readonly trendLabels = computed(() => {
    const t = this.pageViewsTrend();
    return t.map((p) => this.formatLabel(p.date));
  });

  readonly pageViewsSeries = computed(() => this.pageViewsTrend().map((p) => p.count));
  readonly uniqueVisitorsSeries = computed(() => this.uniqueVisitorsTrend().map((p) => p.count));
  readonly engagementSeries = computed(() => this.engagementTrend().map((p) => p.count));

  // Derived percentages
  readonly hasOverview = computed(() => this.state().overview !== null);
  readonly isStale = computed(() => {
    const t = this.state().lastOverviewLoad;
    return t === null || Date.now() - t > 5 * 60 * 1000;
  });

  // --- Actions --------------------------------------------------------------
  setRange(range: AnalyticsRange): void {
    this.state.update((s) => ({ ...s, range }));
    void this.loadOverview(range);
    void this.loadDetails(range);
  }

  loadOverview(range: AnalyticsRange = this.state().range): Promise<void> {
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
          const message = err?.error?.error?.message ?? 'Unable to load analytics overview.';
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

  loadDetails(range: AnalyticsRange = this.state().range): Promise<void> {
    this.state.update((s) => ({ ...s, loadingDetails: true, errorDetails: null }));
    return new Promise<void>((resolve) => {
      this.api
        .getTopPages(range, 10)
        .toPromise()
        .then((pages) => {
          this.api
            .getTopReferrers(range, 10)
            .toPromise()
            .then((referrers) => {
              this.api
                .getTopCountries(range, 10)
                .toPromise()
                .then((countries) => {
                  this.api
                    .getTopCities(range, 10)
                    .toPromise()
                    .then((cities) => {
                      this.api
                        .getDeviceBreakdown(range)
                        .toPromise()
                        .then((devices) => {
                          this.api
                            .getTopBrowsers(range, 10)
                            .toPromise()
                            .then((browsers) => {
                              this.api
                                .getTopOS(range, 10)
                                .toPromise()
                                .then((os) => {
                                  this.state.update((s) => ({
                                    ...s,
                                    topPages: pages?.data ?? [],
                                    topReferrers: referrers?.data ?? [],
                                    topCountries: countries?.data ?? [],
                                    topCities: cities?.data ?? [],
                                    deviceBreakdown: devices?.data ?? null,
                                    topBrowsers: browsers?.data ?? [],
                                    topOS: os?.data ?? [],
                                    loadingDetails: false,
                                  }));
                                  resolve();
                                });
                            });
                        });
                    });
                });
            });
        })
        .catch((err) => {
          const message = err?.error?.error?.message ?? 'Unable to load analytics details.';
          this.state.update((s) => ({
            ...s,
            loadingDetails: false,
            errorDetails: message,
          }));
          resolve();
        });
    });
  }

  refreshAll(): void {
    void this.loadOverview(this.state().range);
    void this.loadDetails(this.state().range);
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
