import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import { ThemeConfig } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class ThemeBuilderApiService {
  private readonly apiData = inject(ApiDataService);

  getThemeConfig(): Observable<ThemeConfig> {
    return this.apiData.getData<ThemeConfig>('/theme/config');
  }

  updateThemeConfig(config: Partial<ThemeConfig>): Observable<ThemeConfig> {
    return this.apiData.putData<ThemeConfig>('/theme/config', config);
  }

}
