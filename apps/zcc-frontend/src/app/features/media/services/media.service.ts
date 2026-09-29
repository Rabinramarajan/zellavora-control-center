import { Injectable, inject } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { Observable, from, map, switchMap } from 'rxjs';
import { ApiDataService } from '@core/http/api-data.service';
import { MediaItem, MediaListParams, MediaPage } from '../models/media.model';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly apiData = inject(ApiDataService);

  list(params: MediaListParams = {}): Observable<MediaPage> {
    const query: Record<string, string> = {};
    if (params.prefix) query['prefix'] = params.prefix;
    if (params.cursor) query['cursor'] = params.cursor;
    if (params.limit) query['limit'] = String(params.limit);

    return this.apiData
      .getData<ApiEnvelope<MediaPage>>('/storage/media', query, { hideFullSpinner: true })
      .pipe(map((res) => res.data));
  }

  upload(file: File, folder = ''): Observable<MediaItem> {
    return from(readAsDataUrl(file)).pipe(
      switchMap((base64Data) =>
        this.apiData.postData<ApiEnvelope<MediaItem>>(
          '/storage/media',
          { fileName: file.name, folder, mimeType: file.type || undefined, base64Data },
          { hideFullSpinner: true }
        )
      ),
      map((res) => res.data)
    );
  }

  delete(item: MediaItem): Observable<void> {
    const path = `/storage/media?pathname=${encodeURIComponent(item.pathname)}`;
    return this.apiData.deleteData<ApiEnvelope<unknown>>(path).pipe(map(() => undefined));
  }

  /**
   * Private items (documents) are only served to authenticated callers, so their bytes
   * are fetched through the API (which carries the JWT) and exposed as an object URL.
   */
  fetchPrivateContent(item: MediaItem): Observable<Blob> {
    return this.apiData
      .getData<HttpResponse<Blob>>(
        '/storage/media/file',
        { pathname: item.pathname },
        { responseType: 'blob', hideFullSpinner: true }
      )
      .pipe(map((res) => res.body ?? new Blob([], { type: item.mimeType })));
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}
