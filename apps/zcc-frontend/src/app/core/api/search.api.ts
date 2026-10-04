import { Injectable, inject } from '@angular/core';
import { Observable, map, timeout } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import { ApiEnvelope } from '../../shared/models/iam.model';
import { SearchRequest, SearchResponse } from '../../shared/models/search.model';
import { SearchEndpoint } from './search-endpoints';

/** A search that has not answered in this long is reported as a timeout. */
export const SEARCH_TIMEOUT_MS = 30_000;

/** Typed transport for the standard GET-criteria / POST-search pair. */
@Injectable({ providedIn: 'root' })
export class SearchApiService {
  private readonly api = inject(ApiDataService);

  public criteria<TCriteria extends object>(
    endpoint: SearchEndpoint
  ): Observable<SearchRequest<TCriteria>> {
    return this.api.getData<ApiEnvelope<SearchRequest<TCriteria>>>(endpoint.criteria).pipe(
      timeout(SEARCH_TIMEOUT_MS),
      map((r) => r.data)
    );
  }

  public search<TCriteria extends object, TItem, TSummary = undefined>(
    endpoint: SearchEndpoint,
    request: SearchRequest<TCriteria>
  ): Observable<SearchResponse<TItem, TSummary>> {
    return this.api
      .postData<ApiEnvelope<SearchResponse<TItem, TSummary>>>(endpoint.search, request)
      .pipe(
        timeout(SEARCH_TIMEOUT_MS),
        map((r) => r.data)
      );
  }
}
