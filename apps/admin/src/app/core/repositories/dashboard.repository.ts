import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { DashboardApiService } from '@core/api/dashboard.api';

@Injectable({ providedIn: 'root' })
export class DashboardRepository {
  private readonly api = inject(DashboardApiService);

  private readonly _stats = signal<any>(null);
  private readonly _activities = signal<any[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly stats = computed(() => this._stats());
  readonly activities = computed(() => this._activities());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());

  loadDashboardData(): Observable<any> {
    this._loading.set(true);
    this._error.set(null);
    return this.api.getDashboardStats().pipe(
      tap((data) => {
        this._stats.set(data);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._error.set(err.message || 'Failed to load dashboard statistics');
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  loadActivities(): Observable<any[]> {
    this._loading.set(true);
    return this.api.getDashboardActivities().pipe(
      tap((activities) => {
        this._activities.set(activities);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }
}
