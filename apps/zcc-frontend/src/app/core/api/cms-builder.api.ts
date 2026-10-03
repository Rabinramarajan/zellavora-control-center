import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import {
  CmsPage,
  CmsPageStats,
  CmsPageVersion,
  CmsCreatePageRequest,
  PaginatedCmsPages,
  CmsPageListParams,
} from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class CmsBuilderApiService {
  private readonly apiData = inject(ApiDataService);

  getPages(params?: Partial<CmsPageListParams>): Observable<PaginatedCmsPages> {
    const q: Record<string, string | number> = {};
    if (params?.q) q['q'] = params.q;
    if (params?.status) q['status'] = params.status;
    if (params?.type) q['type'] = params.type;
    if (params?.page) q['page'] = params.page;
    if (params?.pageSize) q['pageSize'] = params.pageSize;
    if (params?.sortBy) q['sortBy'] = params.sortBy;
    if (params?.sortDir) q['sortDir'] = params.sortDir;
    return this.apiData.getData<PaginatedCmsPages>('/cms/pages', q);
  }

  getStats(): Observable<CmsPageStats> {
    return this.apiData.getData<CmsPageStats>('/cms/pages/stats');
  }

  getPage(id: string): Observable<CmsPage> {
    return this.apiData.getData<CmsPage>(`/cms/pages/${id}`);
  }

  createPage(payload: CmsCreatePageRequest): Observable<CmsPage> {
    return this.apiData.postData<CmsPage>('/cms/pages', payload);
  }

  savePage(id: string, page: Partial<CmsPage>): Observable<CmsPage> {
    return this.apiData.patchData<CmsPage>(`/cms/pages/${id}`, page);
  }

  deletePage(id: string): Observable<void> {
    return this.apiData.deleteData<void>(`/cms/pages/${id}`);
  }

  duplicatePage(id: string): Observable<CmsPage> {
    return this.apiData.postData<CmsPage>(`/cms/pages/${id}/duplicate`, {});
  }

  publishPage(id: string): Observable<CmsPage> {
    return this.apiData.postData<CmsPage>(`/cms/pages/${id}/publish`, {});
  }

  unpublishPage(id: string): Observable<CmsPage> {
    return this.apiData.postData<CmsPage>(`/cms/pages/${id}/unpublish`, {});
  }

  schedulePage(id: string, scheduledAt: string): Observable<CmsPage> {
    return this.apiData.postData<CmsPage>(`/cms/pages/${id}/schedule`, { scheduledAt });
  }

  getVersions(id: string): Observable<CmsPageVersion[]> {
    return this.apiData.getData<CmsPageVersion[]>(`/cms/pages/${id}/versions`);
  }

  restoreVersion(pageId: string, versionId: string): Observable<CmsPage> {
    return this.apiData.postData<CmsPage>(`/cms/pages/${pageId}/versions/${versionId}/restore`, {});
  }

  saveBuilder(id: string, page: Pick<CmsPage, 'sections' | 'version'>): Observable<CmsPage> {
    return this.apiData.putData<CmsPage>(`/cms/pages/${id}/builder`, page);
  }

  checkSlug(slug: string, excludeId?: string): Observable<{ available: boolean }> {
    const q: Record<string, string> = { slug };
    if (excludeId) q['excludeId'] = excludeId;
    return this.apiData.getData<{ available: boolean }>('/cms/pages/slug-check', q);
  }
}
