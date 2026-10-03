import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import { ApiEnvelope, PaginatedList } from '../../shared/models/iam.model';
import { SaveThemeRequest, Theme } from '../../shared/models/theme-builder.model';

export interface ThemeListQuery {
  q?: string;
  mode?: string;
  page: number;
  pageSize: number;
  sort?: string;
  order?: string;
}

@Injectable({ providedIn: 'root' })
export class ThemesApiService {
  private readonly apiData = inject(ApiDataService);
  private readonly base = '/themes';

  /** The organization's active theme (or the built-in default); used on every sign-in. */
  public active(): Observable<Theme> {
    return this.apiData
      .getData<ApiEnvelope<Theme>>(`${this.base}/active`, undefined, {
        hideErrorMethod: true,
        hideFullSpinner: true,
      })
      .pipe(map((r) => r.data));
  }

  public list(query: ThemeListQuery): Observable<PaginatedList<Theme>> {
    const params = Object.fromEntries(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== '')
    );
    return this.apiData
      .getData<ApiEnvelope<PaginatedList<Theme>>>(this.base, params)
      .pipe(map((r) => r.data));
  }

  public get(id: string): Observable<Theme> {
    return this.apiData.getData<ApiEnvelope<Theme>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  public create(body: SaveThemeRequest): Observable<Theme> {
    return this.apiData.postData<ApiEnvelope<Theme>>(this.base, body).pipe(map((r) => r.data));
  }

  public update(id: string, body: SaveThemeRequest): Observable<Theme> {
    return this.apiData
      .patchData<ApiEnvelope<Theme>>(`${this.base}/${id}`, body)
      .pipe(map((r) => r.data));
  }

  public activate(id: string): Observable<Theme> {
    return this.apiData
      .postData<ApiEnvelope<Theme>>(`${this.base}/${id}/activate`, {})
      .pipe(map((r) => r.data));
  }

  public duplicate(id: string, name: string): Observable<Theme> {
    return this.apiData
      .postData<ApiEnvelope<Theme>>(`${this.base}/${id}/duplicate`, { name })
      .pipe(map((r) => r.data));
  }

  public remove(id: string): Observable<unknown> {
    return this.apiData.deleteData<unknown>(`${this.base}/${id}`);
  }
}
