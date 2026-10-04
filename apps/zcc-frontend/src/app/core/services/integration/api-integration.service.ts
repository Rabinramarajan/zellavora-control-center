import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface ApiSingleResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class ApiIntegrationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/v1';

  // ========== SETTINGS ==========
  getSettings<T = unknown>(section?: string): Observable<ApiSingleResponse<T>> {
    return this.http.get<ApiSingleResponse<T>>(this.settingsUrl(section));
  }

  updateSettings<T = unknown>(section: string, settings: T): Observable<ApiSingleResponse<T>> {
    return this.http.put<ApiSingleResponse<T>>(this.settingsUrl(section), settings);
  }

  private settingsUrl(section?: string): string {
    const base = `${this.apiUrl}/settings`;
    return section ? `${base}/${encodeURIComponent(section)}` : base;
  }
}