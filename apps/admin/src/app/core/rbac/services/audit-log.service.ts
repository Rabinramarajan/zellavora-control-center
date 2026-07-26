/**
 * AuditLogService — fetch and search audit entries.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AuditEntry {
  id: number;
  organizationId: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  decision?: 'allow' | 'deny';
  permissionKey?: string;
  description?: string;
  oldValues?: unknown;
  newValues?: unknown;
  context?: Record<string, unknown>;
  createdAt: string;
  prevHash?: string;
  hash?: string;
}

export interface AuditPage {
  data: AuditEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private http = inject(HttpClient);

  search(opts: {
    actor?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<AuditPage> {
    return firstValueFrom(
      this.http.get<AuditPage>('/api/v1/rbac/audit-logs', { params: opts as any })
    );
  }

  export(opts: { from?: string; to?: string } = {}): Promise<Blob> {
    return firstValueFrom(
      this.http.post('/api/v1/rbac/audit-logs/export', opts, { responseType: 'blob' })
    );
  }
}
