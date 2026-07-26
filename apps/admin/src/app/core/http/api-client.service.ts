import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, retry, timeout } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    version: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ApiClientService {
  private readonly baseUrl = '/api/v1';
  private readonly timeout = 30000;
  private readonly retryAttempts = 3;

  constructor(private http: HttpClient) {}

  get<T>(endpoint: string, params?: Record<string, any>): Observable<T> {
    const url = this.buildUrl(endpoint);
    return this.http
      .get<ApiResponse<T>>(url, { params })
      .pipe(
        timeout(this.timeout),
        retry({ count: this.retryAttempts, delay: 1000 }),
        map((response) => this.handleSuccess(response)),
        catchError((error) => this.handleError(error))
      );
  }

  post<T>(endpoint: string, body?: any): Observable<T> {
    const url = this.buildUrl(endpoint);
    return this.http
      .post<ApiResponse<T>>(url, body || {})
      .pipe(
        timeout(this.timeout),
        map((response) => this.handleSuccess(response)),
        catchError((error) => this.handleError(error))
      );
  }

  put<T>(endpoint: string, body?: any): Observable<T> {
    const url = this.buildUrl(endpoint);
    return this.http
      .put<ApiResponse<T>>(url, body || {})
      .pipe(
        timeout(this.timeout),
        map((response) => this.handleSuccess(response)),
        catchError((error) => this.handleError(error))
      );
  }

  delete<T>(endpoint: string): Observable<T> {
    const url = this.buildUrl(endpoint);
    return this.http
      .delete<ApiResponse<T>>(url)
      .pipe(
        timeout(this.timeout),
        map((response) => this.handleSuccess(response)),
        catchError((error) => this.handleError(error))
      );
  }

  private handleSuccess<T>(response: ApiResponse<T>): T {
    if (!response.success || !response.data) {
      throw new Error('Invalid API response');
    }
    return response.data;
  }

  private handleError(error: HttpErrorResponse) {
    const apiError = {
      code: error.status.toString(),
      message: error.message || 'An error occurred',
      statusCode: error.status,
      details: error.error?.error?.details,
    };

    console.error('[API Error]', apiError);
    return throwError(() => apiError);
  }

  private buildUrl(endpoint: string): string {
    if (endpoint.startsWith('http')) {
      return endpoint;
    }
    return `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  }
}
