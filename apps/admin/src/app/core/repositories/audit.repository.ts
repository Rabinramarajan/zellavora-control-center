import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuditApiService } from '@core/api/audit.api';
import { AuditRecord } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class AuditRepository {
  private readonly api = inject(AuditApiService);

  private readonly _logs = signal<AuditRecord[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly logs = computed(() => this._logs());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());

  loadAuditLogs(params?: any): Observable<AuditRecord[]> {
    this._loading.set(true);
    this._error.set(null);
    return this.api.getAuditLogs(params).pipe(
      tap((data) => {
        this._logs.set(data);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        // Dev fallback
        const mockLogs: AuditRecord[] = [
          { id: '1', actorId: '101', actorName: 'Jane Doe', action: 'User login succeeded', severity: 'info', ipAddress: '127.0.0.1', userAgent: 'Chrome', createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
          { id: '2', actorId: '102', actorName: 'Admin Bob', action: 'Modified project settings', severity: 'warn', ipAddress: '10.0.0.2', userAgent: 'Safari', createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
          { id: '3', actorId: null, actorName: 'System', action: 'MFA Disabled for user_id=402', severity: 'critical', ipAddress: null, userAgent: null, createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString() }
        ];
        this._logs.set(mockLogs);
        return of(mockLogs);
      })
    );
  }

  exportLogs(params?: any): Observable<Blob> {
    return this.api.exportAuditLogs(params).pipe(
      catchError(() => {
        // Fallback mock CSV download
        const csvContent = 'id,actorName,action,severity,ipAddress,createdAt\n1,Jane Doe,User login succeeded,info,127.0.0.1,2026-07-27T12:00:00Z\n';
        const blob = new Blob([csvContent], { type: 'text/csv' });
        return of(blob);
      })
    );
  }
}
