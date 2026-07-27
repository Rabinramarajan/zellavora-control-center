import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType, HttpProgressEvent } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { map, filter } from 'rxjs/operators';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResponse {
  success: boolean;
  data?: {
    id: string;
    url: string;
    filename: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
  };
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FileUploadService {
  private http = inject(HttpClient);
  private apiUrl = '/api/v1/media';
  private uploadProgress$ = new Subject<UploadProgress>();

  /**
   * Upload a single file
   */
  uploadFile(file: File, category?: string): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (category) {
      formData.append('category', category);
    }

    return this.http
      .post<UploadResponse>(`${this.apiUrl}/upload`, formData, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        filter(
          (event) => event.type === HttpEventType.Response
        ),
        map((event) => (event as any).body as UploadResponse)
      );
  }

  /**
   * Upload multiple files
   */
  uploadMultipleFiles(
    files: File[],
    category?: string
  ): Observable<UploadResponse[]> {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`files`, file);
    });
    if (category) {
      formData.append('category', category);
    }

    return this.http
      .post<UploadResponse[]>(`${this.apiUrl}/upload-multiple`, formData, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        filter(
          (event) => event.type === HttpEventType.Response
        ),
        map((event) => (event as any).body as UploadResponse[])
      );
  }

  /**
   * Get upload progress
   */
  getUploadProgress(): Observable<UploadProgress> {
    return this.uploadProgress$.asObservable();
  }

  /**
   * Delete a file
   */
  deleteFile(fileId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/${fileId}`
    );
  }

  /**
   * Get file metadata
   */
  getFileMetadata(fileId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${fileId}`);
  }

  /**
   * Get all files with filters
   */
  getFiles(filters?: {
    type?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Observable<any> {
    let url = `${this.apiUrl}/list`;
    const params = new URLSearchParams();

    if (filters?.type) params.append('type', filters.type);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    return this.http.get<any>(url);
  }

  /**
   * Get presigned URL for direct upload to S3
   */
  getPresignedUrl(filename: string, contentType: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/presigned-url`, {
      filename,
      contentType,
    });
  }

  /**
   * Validate file before upload
   */
  validateFile(
    file: File,
    options?: {
      maxSize?: number; // in bytes
      allowedTypes?: string[];
    }
  ): { valid: boolean; error?: string } {
    // Default max size: 50MB
    const maxSize = options?.maxSize || 50 * 1024 * 1024;

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit`,
      };
    }

    if (options?.allowedTypes && !options.allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed`,
      };
    }

    return { valid: true };
  }
}
