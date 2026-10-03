import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import {
  AnalyticsOverview,
  AnalyticsRange,
  ApiEnvelope,
  TrackEventRequest,
} from '../../shared/models/analytics.model';

@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  private readonly apiData = inject(ApiDataService);

  /** KPIs, daily trend and every breakdown for the window in one round trip. */
  public getOverview(range: AnalyticsRange): Observable<ApiEnvelope<AnalyticsOverview>> {
    return this.apiData.getData<ApiEnvelope<AnalyticsOverview>>('/analytics/overview', { range });
  }

  public exportCsv(range: AnalyticsRange): Observable<Blob> {
    return this.apiData.getData<Blob>(
      '/analytics/export',
      { range, format: 'csv' },
      { responseType: 'blob' }
    );
  }

  public track(event: TrackEventRequest): Observable<unknown> {
    // Fire-and-forget: tracking must never show a spinner or an error toast.
    return this.apiData.postData<unknown>('/analytics/events', event, {
      hideErrorMethod: true,
      hideFullSpinner: true,
    });
  }
}
