import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import { ApiEnvelope, PaginatedList } from '../../shared/models/iam.model';
import { BlogCategory, BlogPost, BlogStats, SavePostRequest } from '../../shared/models/blog.model';

export type BlogListQuery = Record<string, string | number | undefined>;

@Injectable({ providedIn: 'root' })
export class BlogApiService {
  private readonly apiData = inject(ApiDataService);
  private readonly base = '/blog';

  public list(query: BlogListQuery): Observable<PaginatedList<BlogPost>> {
    const params = Object.fromEntries(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== '')
    );
    return this.apiData
      .getData<ApiEnvelope<PaginatedList<BlogPost>>>(`${this.base}/posts`, params)
      .pipe(map((r) => r.data));
  }

  public stats(): Observable<BlogStats> {
    return this.apiData
      .getData<ApiEnvelope<BlogStats>>(`${this.base}/stats`, undefined, { hideFullSpinner: true })
      .pipe(map((r) => r.data));
  }

  public categories(): Observable<BlogCategory[]> {
    return this.apiData
      .getData<ApiEnvelope<BlogCategory[]>>(`${this.base}/categories`, undefined, {
        hideFullSpinner: true,
      })
      .pipe(map((r) => r.data));
  }

  public get(id: string): Observable<BlogPost> {
    return this.apiData
      .getData<ApiEnvelope<BlogPost>>(`${this.base}/posts/${id}`)
      .pipe(map((r) => r.data));
  }

  public create(body: SavePostRequest): Observable<BlogPost> {
    return this.apiData
      .postData<ApiEnvelope<BlogPost>>(`${this.base}/posts`, body)
      .pipe(map((r) => r.data));
  }

  public update(id: string, body: Partial<SavePostRequest>): Observable<BlogPost> {
    return this.apiData
      .patchData<ApiEnvelope<BlogPost>>(`${this.base}/posts/${id}`, body)
      .pipe(map((r) => r.data));
  }

  /** Publishes now, or schedules when `publishAt` is in the future. */
  public publish(id: string, publishAt?: string): Observable<BlogPost> {
    return this.apiData
      .postData<ApiEnvelope<BlogPost>>(
        `${this.base}/posts/${id}/publish`,
        publishAt ? { publishAt } : {}
      )
      .pipe(map((r) => r.data));
  }

  public unpublish(id: string): Observable<BlogPost> {
    return this.apiData
      .postData<ApiEnvelope<BlogPost>>(`${this.base}/posts/${id}/unpublish`, {})
      .pipe(map((r) => r.data));
  }

  public duplicate(id: string): Observable<BlogPost> {
    return this.apiData
      .postData<ApiEnvelope<BlogPost>>(`${this.base}/posts/${id}/duplicate`, {})
      .pipe(map((r) => r.data));
  }

  public remove(id: string): Observable<unknown> {
    return this.apiData.deleteData<unknown>(`${this.base}/posts/${id}`);
  }
}
