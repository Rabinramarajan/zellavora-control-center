import { QueryParamHelper, QueryOptions } from './query-param.helper';

describe('QueryParamHelper', () => {
  it('should build pagination and sorting parameters', () => {
    const opts: QueryOptions = {
      page: 2,
      pageSize: 15,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };

    const params = QueryParamHelper.buildParams(opts);

    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('15');
    expect(params.get('sortBy')).toBe('createdAt');
    expect(params.get('sortOrder')).toBe('desc');
  });

  it('should build filter and multi-select parameters', () => {
    const opts: QueryOptions = {
      filters: {
        status: 'published',
        tags: ['angular', 'rxjs'],
      },
    };

    const params = QueryParamHelper.buildParams(opts);

    expect(params.get('status')).toBe('published');
    expect(params.get('tags')).toBe('angular,rxjs');
  });
});
