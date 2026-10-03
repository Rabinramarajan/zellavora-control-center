import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '../../core/http/api-data.service';
import {
  ApiEnvelope,
  AnalyticsOverview,
  AnalyticsTopItem,
  AnalyticsDeviceBreakdown,
  AnalyticsRange,
} from './analytics.models';

@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  private readonly apiData = inject(ApiDataService);

  getOverview(range: AnalyticsRange = '30'): Observable<ApiEnvelope<AnalyticsOverview>> {
    return this.apiData.getData<ApiEnvelope<AnalyticsOverview>>('/analytics/overview', { range });
  }

  getTopPages(
    range: AnalyticsRange = '30',
    limit: number = 10
  ): Observable<ApiEnvelope<AnalyticsTopItem[]>> {
    return this.apiData.getData<ApiEnvelope<AnalyticsTopItem[]>>('/analytics/top-pages', {
      range,
      limit,
    });
  }

  getTopReferrers(
    range: AnalyticsRange = '30',
    limit: number = 10
  ): Observable<ApiEnvelope<AnalyticsTopItem[]>> {
    return this.apiData.getData<ApiEnvelope<AnalyticsTopItem[]>>('/analytics/top-referrers', {
      range,
      limit,
    });
  }

  getTopCountries(
    range: AnalyticsRange = '30',
    limit: number = 10
  ): Observable<ApiEnvelope<AnalyticsTopItem[]>> {
    return this.apiData.getData<ApiEnvelope<AnalyticsTopItem[]>>('/analytics/top-countries', {
      range,
      limit,
    });
  }

  getTopCities(
    range: AnalyticsRange = '30',
    limit: number = 10
  ): Observable<ApiEnvelope<AnalyticsTopItem[]>> {
    return this.apiData.getData<ApiEnvelope<AnalyticsTopItem[]>>('/analytics/top-cities', {
      range,
      limit,
    });
  }

  getDeviceBreakdown(
    range: AnalyticsRange = '30'
  ): Observable<ApiEnvelope<AnalyticsDeviceBreakdown>> {
    return this.apiData.getData<ApiEnvelope<AnalyticsDeviceBreakdown>>(
      '/analytics/device-breakdown',
      { range }
    );
  }

  getTopBrowsers(
    range: AnalyticsRange = '30',
    limit: number = 10
  ): Observable<ApiEnvelope<AnalyticsTopItem[]>> {
    return this.apiData.getData<ApiEnvelope<AnalyticsTopItem[]>>('/analytics/top-browsers', {
      range,
      limit,
    });
  }

  getTopOS(
    range: AnalyticsRange = '30',
    limit: number = 10
  ): Observable<ApiEnvelope<AnalyticsTopItem[]>> {
    return this.apiData.getData<ApiEnvelope<AnalyticsTopItem[]>>('/analytics/top-os', {
      range,
      limit,
    });
  }

  export(
    range: AnalyticsRange = '30',
    format: 'json' | 'csv' = 'json'
  ): Observable<ApiEnvelope<unknown>> {
    return this.apiData.getData<ApiEnvelope<unknown>>('/analytics/export', { range, format });
  }
}
