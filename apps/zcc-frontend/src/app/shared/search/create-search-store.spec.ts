import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError, TimeoutError } from 'rxjs';
import { SearchApiService } from '../../core/api/search.api';
import { SEARCH_ENDPOINTS } from '../../core/api/search-endpoints';
import { ErrorBus } from '../../core/error/error-bus';
import { SearchRequest, SearchResponse } from '../models/search.model';
import { SearchStore, createSearchStore, searchErrorMessage } from './create-search-store';

interface Criteria {
  name: string | null;
}

const DEFAULTS: SearchRequest<Criteria> = {
  name: null,
  pageNumber: 1,
  pageSize: 10,
  orderByColumnName: '',
  ascending: true,
};

const page = (
  request: SearchRequest<Criteria>,
  items: string[],
  totalCount = items.length
): SearchResponse<string> => ({
  pageNumber: request.pageNumber,
  pageSize: request.pageSize,
  totalCount,
  items,
  msg: { errorMessage: [], infoMessage: null },
});

describe('createSearchStore', () => {
  let api: jasmine.SpyObj<SearchApiService>;
  let bus: jasmine.SpyObj<ErrorBus>;

  const create = (): SearchStore<Criteria, string> =>
    runInInjectionContext(TestBed.inject(Injector), () =>
      createSearchStore<Criteria, string>({ endpoint: SEARCH_ENDPOINTS.users, autoInit: false })
    );

  const lastRequest = (): SearchRequest<Criteria> =>
    api.search.calls.mostRecent().args[1] as SearchRequest<Criteria>;

  beforeEach(() => {
    api = jasmine.createSpyObj<SearchApiService>('SearchApiService', ['criteria', 'search']);
    bus = jasmine.createSpyObj<ErrorBus>('ErrorBus', ['push']);
    api.criteria.and.returnValue(of(DEFAULTS) as Observable<never>);
    api.search.and.callFake(((_e: unknown, r: SearchRequest<Criteria>) =>
      of(page(r, ['a', 'b'], 42))) as never);
    TestBed.configureTestingModule({
      providers: [
        { provide: SearchApiService, useValue: api },
        { provide: ErrorBus, useValue: bus },
      ],
    });
  });

  it('loads the default criteria and runs the initial search with them', async () => {
    const store = create();
    await store.init();

    expect(api.criteria).toHaveBeenCalledWith(SEARCH_ENDPOINTS.users);
    expect(lastRequest()).toEqual(DEFAULTS);
    expect(store.items()).toEqual(['a', 'b']);
    expect(store.totalCount()).toBe(42);
    expect(store.totalPages()).toBe(5);
    expect(store.loading()).toBeFalse();
    expect(store.searched()).toBeTrue();
  });

  it('searches from page 1 while keeping page size and sort', async () => {
    const store = create();
    await store.init();
    await store.setPage(3, 25);
    await store.sortBy({ key: 'fullName', dir: 'desc' });
    await store.setPage(2);

    await store.search({ name: 'ada' });

    expect(lastRequest()).toEqual({
      name: 'ada',
      pageNumber: 1,
      pageSize: 25,
      orderByColumnName: 'fullName',
      ascending: false,
    });
    expect(store.criteria()).toEqual({ name: 'ada' });
    expect(store.sort()).toEqual({ key: 'fullName', dir: 'desc' });
  });

  it('goes back to page 1 when the page size changes', async () => {
    const store = create();
    await store.init();
    await store.setPage(4, 50);
    expect(lastRequest().pageNumber).toBe(1);
    expect(lastRequest().pageSize).toBe(50);
  });

  it('reset restores the server defaults', async () => {
    const store = create();
    await store.init();
    await store.search({ name: 'ada' });
    await store.sortBy({ key: 'fullName', dir: 'asc' });

    await store.reset();

    expect(lastRequest()).toEqual(DEFAULTS);
    expect(store.sort()).toBeNull();
  });

  it('does not send an identical request while one is in flight', async () => {
    const store = create();
    await store.init();
    const pending = new Subject<SearchResponse<string>>();
    api.search.and.returnValue(pending as never);
    api.search.calls.reset();

    void store.search({ name: 'ada' });
    void store.search({ name: 'ada' });

    expect(api.search).toHaveBeenCalledTimes(1);
    expect(store.loading()).toBeTrue();
    pending.next(page(lastRequest(), ['x']));
    pending.complete();
  });

  it('ignores a response that is no longer the latest', async () => {
    const store = create();
    await store.init();
    const slow = new Subject<SearchResponse<string>>();
    api.search.and.returnValues(slow as never, of(page(DEFAULTS, ['fresh'])) as never);

    const first = store.search({ name: 'old' });
    await store.search({ name: 'new' });
    slow.next(page(DEFAULTS, ['stale']));
    slow.complete();
    await first;

    expect(store.items()).toEqual(['fresh']);
    expect(store.loading()).toBeFalse();
  });

  it('treats an empty page as a normal result', async () => {
    api.search.and.returnValue(of(page(DEFAULTS, [], 0)) as never);
    const store = create();
    await store.init();

    expect(store.items()).toEqual([]);
    expect(store.error()).toBeNull();
    expect(store.hasItems()).toBeFalse();
    expect(bus.push).not.toHaveBeenCalled();
  });

  it('stops loading and reports a safe message on failure', async () => {
    const store = create();
    await store.init();
    api.search.and.returnValue(
      throwError(() => ({ status: 400, message: 'Invalid date' })) as never
    );

    await store.search({ name: 'x' });

    expect(store.loading()).toBeFalse();
    expect(store.items()).toEqual([]);
    expect(store.error()).toBe('Invalid date');
    expect(bus.push).toHaveBeenCalledWith({ kind: 'error', message: 'Invalid date' });
  });

  it('leaves globally handled errors to the HTTP interceptor toast', async () => {
    const store = create();
    await store.init();
    api.search.and.returnValue(throwError(() => ({ status: 500, message: 'stack…' })) as never);

    await store.reload();

    expect(store.error()).toBe('The search could not be completed. Please try again.');
    expect(bus.push).not.toHaveBeenCalled();
  });

  it('maps errors to user-safe messages', () => {
    expect(searchErrorMessage(new TimeoutError())).toContain('took too long');
    expect(searchErrorMessage({ status: 401 })).toContain('session has expired');
    expect(searchErrorMessage({ status: 403 })).toContain('permission');
    expect(searchErrorMessage({ status: 404 })).toContain('could not be found');
    expect(searchErrorMessage({ status: 0 })).toContain('Network error');
    expect(searchErrorMessage({ status: 503, message: 'db down' })).not.toContain('db down');
  });
});
