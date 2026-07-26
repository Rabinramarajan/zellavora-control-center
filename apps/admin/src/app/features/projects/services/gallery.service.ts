import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import { ProjectGalleryItem } from '@shared/models';

interface GalleryState {
  items: ProjectGalleryItem[];
  isLoading: boolean;
  error: string | null;
  uploadProgress: number;
}

@Injectable({
  providedIn: 'root',
})
export class GalleryService {
  private state = signal<GalleryState>({
    items: [],
    isLoading: false,
    error: null,
    uploadProgress: 0,
  });

  // Public computed signals
  items = () => this.state().items;
  isLoading = () => this.state().isLoading;
  error = () => this.state().error;
  uploadProgress = () => this.state().uploadProgress;

  constructor(private http: HttpClient) {}

  // ========== GET GALLERY ==========

  getGallery(projectId: string): Observable<ProjectGalleryItem[]> {
    this.state.update((s) => ({ ...s, isLoading: true, error: null }));

    return this.http
      .get<ProjectGalleryItem[]>(`/api/v1/projects/${projectId}/gallery`)
      .pipe(
        tap((items) => {
          this.state.update((s) => ({
            ...s,
            items: items.sort((a, b) => a.orderIndex - b.orderIndex),
            isLoading: false,
          }));
        }),
        catchError((error) => this.handleError(error))
      );
  }

  // ========== UPLOAD IMAGE ==========

  uploadImage(
    projectId: string,
    file: File,
    caption?: string
  ): Observable<ProjectGalleryItem> {
    const formData = new FormData();
    formData.append('file', file);
    if (caption) {
      formData.append('caption', caption);
    }

    this.state.update((s) => ({ ...s, isLoading: true, error: null }));

    return this.http
      .post<ProjectGalleryItem>(
        `/api/v1/projects/${projectId}/gallery`,
        formData
      )
      .pipe(
        tap((item) => {
          this.state.update((s) => ({
            ...s,
            items: [...s.items, item].sort(
              (a, b) => a.orderIndex - b.orderIndex
            ),
            isLoading: false,
            uploadProgress: 0,
          }));
        }),
        catchError((error) => this.handleError(error))
      );
  }

  // ========== UPDATE IMAGE ==========

  updateImage(
    projectId: string,
    imageId: string,
    data: Partial<ProjectGalleryItem>
  ): Observable<ProjectGalleryItem> {
    return this.http
      .put<ProjectGalleryItem>(
        `/api/v1/projects/${projectId}/gallery/${imageId}`,
        data
      )
      .pipe(
        tap((updated) => {
          this.state.update((s) => ({
            ...s,
            items: s.items
              .map((item) => (item.id === imageId ? updated : item))
              .sort((a, b) => a.orderIndex - b.orderIndex),
          }));
        }),
        catchError((error) => this.handleError(error))
      );
  }

  // ========== REORDER IMAGES ==========

  reorderImage(
    projectId: string,
    imageId: string,
    newIndex: number
  ): Observable<ProjectGalleryItem> {
    return this.updateImage(projectId, imageId, {
      orderIndex: newIndex,
    });
  }

  // ========== DELETE IMAGE ==========

  deleteImage(projectId: string, imageId: string): Observable<void> {
    return this.http
      .delete<void>(`/api/v1/projects/${projectId}/gallery/${imageId}`)
      .pipe(
        tap(() => {
          this.state.update((s) => ({
            ...s,
            items: s.items.filter((item) => item.id !== imageId),
          }));
        }),
        catchError((error) => this.handleError(error))
      );
  }

  // ========== UTILITY ==========

  clearGallery(): void {
    this.state.set({
      items: [],
      isLoading: false,
      error: null,
      uploadProgress: 0,
    });
  }

  private handleError(error: any): Observable<never> {
    const message = error.error?.error?.message || 'An error occurred';
    this.state.update((s) => ({ ...s, error: message, isLoading: false }));
    console.error('Gallery error:', error);
    return throwError(() => error);
  }
}
