import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
    const url = section ? `${this.apiUrl}/settings/${section}` : `${this.apiUrl}/settings`;
    return this.http.get<ApiSingleResponse<any>>(url);
  }

  updateSettings(section: string, settings: any): Observable<ApiSingleResponse<any>> {
    return this.http.put<ApiSingleResponse<any>>(`${this.apiUrl}/settings/${section}`, settings);
  }
}
