import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { MediaApiService } from '@core/api/media.api';
import { MediaFile } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class MediaRepository {
  private readonly api = inject(MediaApiService);

  private readonly _files = signal<MediaFile[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly files = computed(() => this._files());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());

  loadFiles(params?: any): Observable<MediaFile[]> {
    this._loading.set(true);
    this._error.set(null);
    return this.api.getMediaFiles(params).pipe(
      tap((data) => {
        this._files.set(data);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._error.set(err.message || 'Failed to load media files');
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  uploadFile(file: File, options?: any): Observable<MediaFile> {
    this._loading.set(true);
    return this.api.uploadFile(file, options).pipe(
      tap((newFile) => {
        this._files.update((current) => [...current, newFile]);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  deleteFile(id: string): Observable<void> {
    this._loading.set(true);
    return this.api.deleteFile(id).pipe(
      tap(() => {
        this._files.update((current) => current.filter((f) => f.id !== id));
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }
}
