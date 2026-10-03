import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import { ApiEnvelope } from '../../shared/models/iam.model';
import { SaveThemeRequest, Theme } from '../../shared/models/theme-builder.model';

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

  /** Saves the Theme Builder into the organization's active theme (created on first save). */
  public saveActive(body: SaveThemeRequest): Observable<Theme> {
    return this.apiData
      .putData<ApiEnvelope<Theme>>(`${this.base}/active`, body)
      .pipe(map((r) => r.data));
  }
}
