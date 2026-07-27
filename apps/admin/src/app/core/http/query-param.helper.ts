import { HttpParams } from '@angular/common/http';

export interface QueryOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  searchTerm?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  filters?: Record<string, any>;
  columns?: string[];
}

export class QueryParamHelper {
  /**
   * Build HttpParams matching Swagger query parameter formats.
   */
  static buildParams(options: QueryOptions): HttpParams {
    let params = new HttpParams();

    if (options.page !== undefined) {
      params = params.set('page', options.page.toString());
    }

    if (options.pageSize !== undefined) {
      params = params.set('pageSize', options.pageSize.toString());
    }

    if (options.sortBy !== undefined) {
      params = params.set('sortBy', options.sortBy);
    }

    if (options.sortOrder !== undefined) {
      params = params.set('sortOrder', options.sortOrder);
    }

    if (options.searchTerm !== undefined && options.searchTerm.trim() !== '') {
      params = params.set('searchTerm', options.searchTerm.trim());
    }

    if (options.startDate !== undefined) {
      const start = options.startDate instanceof Date ? options.startDate.toISOString() : options.startDate;
      params = params.set('startDate', start);
    }

    if (options.endDate !== undefined) {
      const end = options.endDate instanceof Date ? options.endDate.toISOString() : options.endDate;
      params = params.set('endDate', end);
    }

    if (options.columns && options.columns.length > 0) {
      params = params.set('columns', options.columns.join(','));
    }

    if (options.filters) {
      Object.keys(options.filters).forEach((key) => {
        const val = options.filters![key];
        if (val === undefined || val === null || val === '') return;

        if (Array.isArray(val)) {
          // Multi-select filters: format as comma-separated or multiple parameters
          if (val.length > 0) {
            params = params.set(key, val.join(','));
          }
        } else {
          params = params.set(key, val.toString());
        }
      });
    }

    return params;
  }
}
