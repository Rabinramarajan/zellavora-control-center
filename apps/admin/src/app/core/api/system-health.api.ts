import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import { SystemMetrics } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class SystemHealthApiService {
  private readonly apiData = inject(ApiDataService);

  getHealthMetrics(): Observable<SystemMetrics> {
    // Hits the health checker on the backend API root
    return this.apiData.getData<SystemMetrics>('/health', undefined, { hideJwt: true });
  }
}
