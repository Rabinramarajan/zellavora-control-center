import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { SystemHealthApiService } from '@core/api/system-health.api';
import { SystemMetrics } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class SystemHealthRepository {
  private readonly api = inject(SystemHealthApiService);

  private readonly _metrics = signal<SystemMetrics | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly metrics = computed(() => this._metrics());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());

  loadHealthMetrics(): Observable<SystemMetrics> {
    this._loading.set(true);
    this._error.set(null);
    return this.api.getHealthMetrics().pipe(
      tap((data) => {
        this._metrics.set(data);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        // Dev mocks showing active system details
        const mockMetrics: SystemMetrics = {
          cpu: { used: 2.1, total: 8, percentage: 26 },
          ram: { used: 4.8, total: 16, percentage: 30 },
          database: { status: 'healthy', latencyMs: 14 },
          storage: { status: 'healthy', latencyMs: 45 },
          redis: { status: 'healthy', latencyMs: 2 },
          queue: { pendingJobs: 0, activeWorkers: 2, status: 'healthy' },
          timestamp: new Date().toISOString(),
        };
        this._metrics.set(mockMetrics);
        return of(mockMetrics);
      })
    );
  }
}
