import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ServiceHealthResult, SystemHealthDashboard } from './system-health.models';

@Injectable({ providedIn: 'root' })
export class SystemHealthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/operations/health';

  getHealth(fresh = false): Observable<SystemHealthDashboard> {
    const params = fresh ? { refresh: 'true' } : undefined;
    return this.http.get<SystemHealthDashboard>(this.baseUrl, { params });
  }

  getServices(): Observable<ServiceHealthResult[]> {
    return this.http.get<ServiceHealthResult[]>(`${this.baseUrl}/services`);
  }

  getService(serviceId: string): Observable<ServiceHealthResult> {
    return this.http.get<ServiceHealthResult>(`${this.baseUrl}/services/${encodeURIComponent(serviceId)}`);
  }

  getLiveness(): Observable<{ status: string; uptime: number; timestamp: string }> {
    return this.http.get<{ status: string; uptime: number; timestamp: string }>(`${this.baseUrl}/liveness`);
  }

  getReadiness(): Observable<{ status: string; database: string; timestamp: string }> {
    return this.http.get<{ status: string; database: string; timestamp: string }>(`${this.baseUrl}/readiness`);
  }
}
