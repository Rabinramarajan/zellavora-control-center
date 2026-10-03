import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AnalyticsApiService } from '../../core/api/analytics.api';
import { AnalyticsOverview, AnalyticsRange } from '../../shared/models/analytics.model';

interface AnalyticsState {
  range: AnalyticsRange;
  overview: AnalyticsOverview | null;
  loading: boolean;
  error: string | null;
  exporting: boolean;
}

const INITIAL: AnalyticsState = {
  range: '30',
  overview: null,
  loading: false,
  error: null,
  exporting: false,
};

const messageOf = (err: unknown, fallback: string): string =>
  (err as { error?: { error?: { message?: string } } })?.error?.error?.message ?? fallback;

/** Page state for the Analytics screen; one overview request per range change. */
@Injectable({ providedIn: 'root' })
export class AnalyticsStore {
  private readonly api = inject(AnalyticsApiService);
  private readonly state = signal<AnalyticsState>(INITIAL);
  /** Only the latest request may write state, so a slow older range cannot overwrite a newer one. */
  private requestId = 0;

  public readonly range = computed(() => this.state().range);
  public readonly overview = computed(() => this.state().overview);
  public readonly loading = computed(() => this.state().loading);
  public readonly error = computed(() => this.state().error);
  public readonly exporting = computed(() => this.state().exporting);
  /** True while a range switch is reloading data that is already on screen. */
  public readonly refreshing = computed(() => this.loading() && this.overview() !== null);
  public readonly hasTraffic = computed(() => (this.overview()?.kpis.pageViews.value ?? 0) > 0);

  public setRange(range: AnalyticsRange): void {
    if (range === this.range() && this.overview()) return;
    this.state.update((s) => ({ ...s, range }));
    void this.load();
  }

  public async load(): Promise<void> {
    const id = ++this.requestId;
    this.state.update((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await firstValueFrom(this.api.getOverview(this.range()));
      if (id !== this.requestId) return;
      this.state.update((s) => ({ ...s, overview: res.data, loading: false }));
    } catch (err) {
      if (id !== this.requestId) return;
      this.state.update((s) => ({
        ...s,
        loading: false,
        error: messageOf(err, 'Unable to load analytics.'),
      }));
    }
  }

  /** Downloads the CSV report; resolves false when the download failed. */
  public async exportCsv(): Promise<boolean> {
    const range = this.range();
    this.state.update((s) => ({ ...s, exporting: true }));
    try {
      const blob = await firstValueFrom(this.api.exportCsv(range));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-${range}d-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    } finally {
      this.state.update((s) => ({ ...s, exporting: false }));
    }
  }
}
