/**
 * Standard search contract (see backend `infrastructure/search`):
 *   GET  {module}/search/criteria -> SearchRequest<TCriteria>
 *   POST {module}/search          -> SearchResponse<TItem, TSummary>
 */

export interface SearchPaging {
  pageNumber: number;
  pageSize: number;
  /** Empty string means "the module's default order". */
  orderByColumnName: string;
  ascending: boolean;
}

export type SearchRequest<TCriteria extends object> = TCriteria & SearchPaging;

export interface ApiMessageItem {
  id: number;
  msg: string;
  msgType: 'Information' | 'Warning' | 'Error';
}

export interface ApiMessage {
  errorMessage: ApiMessageItem[];
  infoMessage: ApiMessageItem | null;
}

export interface SearchResponse<TItem, TSummary = undefined> {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  items: TItem[];
  summary?: TSummary;
  msg: ApiMessage;
}
