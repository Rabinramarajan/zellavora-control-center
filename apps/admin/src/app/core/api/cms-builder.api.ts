import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import { CmsPage } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class CmsBuilderApiService {
  private readonly apiData = inject(ApiDataService);

  getPages(): Observable<CmsPage[]> {
    return this.apiData.getData<CmsPage[]>('/cms/pages');
  }

  getPageBySlug(slug: string): Observable<CmsPage> {
    return this.apiData.getData<CmsPage>(`/cms/pages/slug/${slug}`);
  }

  savePage(page: Partial<CmsPage>): Observable<CmsPage> {
    return this.apiData.postData<CmsPage>('/cms/pages', page);
  }

  deletePage(id: string): Observable<void> {
    return this.apiData.deleteData<void>(`/cms/pages/${id}`);
  }
}
