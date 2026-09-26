import { Injectable, inject } from '@angular/core';
import { HttpResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';
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

  delete(item: MediaItem): Observable<void> {
    const path = `/storage/media?pathname=${encodeURIComponent(item.pathname)}&access=${item.access}`;
    return this.apiData.deleteData<ApiEnvelope<unknown>>(path).pipe(map(() => undefined));
  }

  /**
   * Private blob URLs reject unauthenticated browser requests, so their bytes are
   * fetched through the API (which carries the JWT) and exposed as an object URL.
   */
  fetchPrivateContent(item: MediaItem): Observable<Blob> {
    return this.apiData
      .getData<HttpResponse<Blob>>(
        '/storage/media/file',
        { pathname: item.pathname, access: item.access },
        { responseType: 'blob', hideFullSpinner: true }
      )
      .pipe(map((res) => res.body ?? new Blob([], { type: item.mimeType })));
  }
}
