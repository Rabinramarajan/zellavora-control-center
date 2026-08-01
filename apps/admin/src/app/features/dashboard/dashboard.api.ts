import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '@core/http/api-data.service';
import {
  ActivityFeedPage,
  ActivityFeedFilters,
  ApiEnvelope,
  DashboardOverview,
  DashboardRange,
} from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly apiData = inject(ApiDataService);

  getOverview(range: DashboardRange = '30'): Observable<ApiEnvelope<DashboardOverview>> {
    return this.apiData.getData<ApiEnvelope<DashboardOverview>>('/dashboard/overview', {
      range,
    });
  }

  getActivityFeed(
    range: DashboardRange,
    page: number,
    pageSize: number,
    filters?: ActivityFeedFilters
  ): Observable<ApiEnvelope<ActivityFeedPage>> {
    return this.apiData.getData<ApiEnvelope<ActivityFeedPage>>('/dashboard/activity', {
      range,
      page,
      pageSize,
      ...(filters?.action ? { action: filters.action } : {}),
      ...(filters?.severity ? { severity: filters.severity } : {}),
    });
  }
}
