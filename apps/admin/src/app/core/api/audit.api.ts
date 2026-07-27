import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import { AuditRecord } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class AuditApiService {
  private readonly apiData = inject(ApiDataService);

  getAuditLogs(params?: any): Observable<AuditRecord[]> {
    return this.apiData.getData<AuditRecord[]>('/admin/audit', params);
  }

  exportAuditLogs(params?: any): Observable<Blob> {
    return this.apiData.getData<Blob>('/admin/audit/export', params, { responseType: 'blob' });
  }
}
