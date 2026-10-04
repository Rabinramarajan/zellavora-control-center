import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AuditDetail,
  AuditFilterCriteria,
  AuditFilterOptions,
  AuditSearchResult,
} from './audit-log.models';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/operations/audit-logs';

  search(
    filters: AuditFilterCriteria,
    page = 1,
    size = 25,
    sort = 'createdAt,desc'
  ): Observable<AuditSearchResult> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        params = params.set(key, String(value).trim());
      }
    });

    return this.http.get<AuditSearchResult>(this.baseUrl, { params });
  }

  getById(auditId: string): Observable<AuditDetail> {
    return this.http.get<AuditDetail>(`${this.baseUrl}/${encodeURIComponent(auditId)}`);
  }

  getFilterOptions(): Observable<AuditFilterOptions> {
    return this.http.get<AuditFilterOptions>(`${this.baseUrl}/filter-options`);
  }

  exportCsv(filters: AuditFilterCriteria, sort = 'createdAt,desc'): Observable<Blob> {
    let params = new HttpParams().set('sort', sort);

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        params = params.set(key, String(value).trim());
      }
    });

    return this.http.get(`${this.baseUrl}/export`, {
      params,
      responseType: 'blob',
    });
  }
}
