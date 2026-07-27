import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly apiData = inject(ApiDataService);

  getDashboardStats(): Observable<any> {
    return this.apiData.getData<any>('/dashboard/stats');
  }

  getDashboardActivities(): Observable<any[]> {
    return this.apiData.getData<any[]>('/dashboard/activities');
  }
}
