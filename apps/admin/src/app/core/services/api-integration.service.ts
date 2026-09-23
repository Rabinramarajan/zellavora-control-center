import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ApiListResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiSingleResponse<T> {
  data: T;
  meta?: Record<string, any>;
}

@Injectable({
  providedIn: 'root',
})
export class ApiIntegrationService {
  private http = inject(HttpClient);
  private apiUrl = '/api/v1';

  // ========== SETTINGS ==========
  getSettings(section?: string): Observable<ApiSingleResponse<any>> {
    const url = section
      ? `${this.apiUrl}/settings/${section}`
      : `${this.apiUrl}/settings`;
    return this.http.get<ApiSingleResponse<any>>(url);
  }

  updateSettings(section: string, settings: any): Observable<ApiSingleResponse<any>> {
    return this.http.put<ApiSingleResponse<any>>(
      `${this.apiUrl}/settings/${section}`,
      settings
    );
  }

  // ========== DAILY SHEETS ==========
  getDailySheets(filters?: Record<string, any>): Observable<ApiListResponse<any>> {
    return this.http.get<ApiListResponse<any>>(`${this.apiUrl}/daily-sheets`, {
      params: filters || {},
    });
  }

  createDailySheet(data: any): Observable<ApiSingleResponse<any>> {
    return this.http.post<ApiSingleResponse<any>>(`${this.apiUrl}/daily-sheets`, data);
  }

  updateDailySheet(id: string, data: any): Observable<ApiSingleResponse<any>> {
    return this.http.put<ApiSingleResponse<any>>(`${this.apiUrl}/daily-sheets/${id}`, data);
  }

  submitDailySheet(id: string): Observable<ApiSingleResponse<any>> {
    return this.http.post<ApiSingleResponse<any>>(`${this.apiUrl}/daily-sheets/${id}/submit`, {});
  }

  approveDailySheet(id: string, data: any): Observable<ApiSingleResponse<any>> {
    return this.http.post<ApiSingleResponse<any>>(`${this.apiUrl}/daily-sheets/${id}/approve`, data);
  }

  deleteDailySheet(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/daily-sheets/${id}`);
  }

  // ========== MONTHLY SHEETS ==========
  getMonthlySheets(filters?: Record<string, any>): Observable<ApiListResponse<any>> {
    return this.http.get<ApiListResponse<any>>(`${this.apiUrl}/monthly-sheets`, {
      params: filters || {},
    });
  }

  createMonthlySheet(data: any): Observable<ApiSingleResponse<any>> {
    return this.http.post<ApiSingleResponse<any>>(`${this.apiUrl}/monthly-sheets`, data);
  }

  approveMonthlySheet(id: string, data: any): Observable<ApiSingleResponse<any>> {
    return this.http.post<ApiSingleResponse<any>>(`${this.apiUrl}/monthly-sheets/${id}/approve`, data);
  }

  markMonthlySheetAsPaid(id: string): Observable<ApiSingleResponse<any>> {
    return this.http.post<ApiSingleResponse<any>>(`${this.apiUrl}/monthly-sheets/${id}/mark-paid`, {});
  }
}
