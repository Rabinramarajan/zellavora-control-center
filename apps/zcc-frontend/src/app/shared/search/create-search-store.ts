/**
 * createSearchStore — the state machine behind every search screen.
 *
 *   init()   GET the default criteria, then run the first search
 *   search() apply new filters from page 1 (keeps page size and sort)
 *   reset()  restore the server defaults and search again
 *   setPage() / sortBy() / reload()
 *
 * Paging and sorting are always server side. Overlapping calls are safe: an identical
 * request already in flight is not sent twice, and a response that is no longer the
 * latest is discarded. Must be called in an injection context (field initializer).
 */
import { Signal, computed, inject, signal } from '@angular/core';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { SearchApiService } from '../../core/api/search.api';
import { SearchEndpoint } from '../../core/api/search-endpoints';
import { ErrorBus } from '../../core/error/error-bus';
import { DataTableSort } from '../components/data-table';
import { ApiMessage, SearchPaging, SearchRequest } from '../models/search.model';

export interface SearchStoreOptions<TCriteria extends object> {
  endpoint: SearchEndpoint;
  /** Overrides applied on top of the server defaults for the first search (e.g. a deep link). */
  initialCriteria?: () => Partial<TCriteria>;
  /** Run init() immediately. Default true. */
  autoInit?: boolean;
}

const PAGING_KEYS: ReadonlyArray<keyof SearchPaging> = [
  'pageNumber',
  'pageSize',
  'orderByColumnName',
  'ascending',
];

/** A user-safe message for a failed search; backend details never reach the UI. */
export function searchErrorMessage(err: unknown): string {
  if (err instanceof TimeoutError) return 'The search took too long. Please try again.';
  const { status, message } = (err ?? {}) as { status?: number; message?: unknown };
  switch (status) {
    case 400:
      return typeof message === 'string' && message.trim()
        ? message
        : 'Some search criteria are invalid.';
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to run this search.';
    case 404:
      return 'The search service could not be found.';
    case 0:
    case undefined:
      return 'Network error. Check your connection and try again.';
    default:
      return 'The search could not be completed. Please try again.';
  }
}

/** Statuses the HTTP error interceptor already toasts (or handles, for 401). */
const toastedGlobally = (err: unknown): boolean => {
  if (err instanceof TimeoutError) return false;
  const status = (err as { status?: number } | null)?.status ?? 0;
  return status === 0 || status === 401 || status === 403 || status >= 500;
};

export interface SearchStore<TCriteria extends object, TItem, TSummary = undefined> {
  /** Server default criteria from the criteria endpoint; what Reset restores. */
  readonly defaults: Signal<SearchRequest<TCriteria> | null>;
  /** The last request sent (filters + paging + sort). */
  readonly request: Signal<SearchRequest<TCriteria> | null>;
  /** Filters only, as applied by the last search. */
  readonly criteria: Signal<TCriteria | null>;
  readonly items: Signal<TItem[]>;
  readonly totalCount: Signal<number>;
  readonly summary: Signal<TSummary | null>;
  readonly message: Signal<ApiMessage | null>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<string | null>;
  /** True once a search has completed, so "no records" is not shown before the first load. */
  readonly searched: Signal<boolean>;
  readonly pageNumber: Signal<number>;
  readonly pageSize: Signal<number>;
  /** Column sort in table form; null while the server's default order applies. */
  readonly sort: Signal<DataTableSort | null>;
  readonly totalPages: Signal<number>;
  readonly hasItems: Signal<boolean>;
  /** Alias of totalCount, shared with createListStore so table templates bind unchanged. */
  readonly total: Signal<number>;
  /** Alias of pageNumber, shared with createListStore so table templates bind unchanged. */
  readonly page: Signal<number>;

  init(): Promise<void>;
  /** New filters from page 1; page size and sort are kept. */
  search(next: Partial<TCriteria>): Promise<void>;
  /** Restores the server's default criteria, paging and sort. */
  reset(): Promise<void>;
  setPage(page: number, size?: number): Promise<void>;
  /** `null` restores the module's default order. */
  sortBy(next: DataTableSort | null): Promise<void>;
  reload(): Promise<void>;
}

export function createSearchStore<TCriteria extends object, TItem, TSummary = undefined>(
  options: SearchStoreOptions<TCriteria>
): SearchStore<TCriteria, TItem, TSummary> {
  const api = inject(SearchApiService);
  const bus = inject(ErrorBus);
  const { endpoint, initialCriteria, autoInit = true } = options;

  const defaults = signal<SearchRequest<TCriteria> | null>(null);
  const request = signal<SearchRequest<TCriteria> | null>(null);
  const items = signal<TItem[]>([]);
  const totalCount = signal(0);
  const summary = signal<TSummary | null>(null);
  const message = signal<ApiMessage | null>(null);
  const loading = signal(false);
  const error = signal<string | null>(null);
  const searched = signal(false);

  let latest = 0;
  let inFlightKey: string | null = null;

  const fail = (err: unknown): void => {
    const text = searchErrorMessage(err);
    error.set(text);
    if (!toastedGlobally(err)) bus.push({ kind: 'error', message: text });
  };

  async function run(next: SearchRequest<TCriteria>): Promise<void> {
    const key = JSON.stringify(next);
    if (loading() && key === inFlightKey) return;
    const seq = ++latest;
    inFlightKey = key;
    request.set(next);
    loading.set(true);
    error.set(null);
    try {
      const res = await firstValueFrom(api.search<TCriteria, TItem, TSummary>(endpoint, next));
      if (seq !== latest) return;
      items.set(res.items);
      totalCount.set(res.totalCount);
      summary.set(res.summary ?? null);
      message.set(res.msg ?? null);
      // The server may clamp paging; reflect what it actually returned.
      request.set({ ...next, pageNumber: res.pageNumber, pageSize: res.pageSize });
      searched.set(true);
    } catch (err) {
      if (seq !== latest) return;
      items.set([]);
      totalCount.set(0);
      fail(err);
    } finally {
      if (seq === latest) {
        loading.set(false);
        inFlightKey = null;
      }
    }
  }

  const current = (): SearchRequest<TCriteria> | null => request() ?? defaults();

  /** Filters only (paging/sorting removed), as applied by the last search. */
  const criteria = computed<TCriteria | null>(() => {
    const r = request();
    if (!r) return null;
    const copy = { ...r } as Record<string, unknown>;
    for (const key of PAGING_KEYS) delete copy[key];
    return copy as TCriteria;
  });

  const pageNumber = computed(() => request()?.pageNumber ?? 1);
  const pageSize = computed(() => request()?.pageSize ?? defaults()?.pageSize ?? 10);
  const sort = computed<DataTableSort | null>(() => {
    const r = request();
    return r?.orderByColumnName
      ? { key: r.orderByColumnName, dir: r.ascending ? 'asc' : 'desc' }
      : null;
  });

  const store: SearchStore<TCriteria, TItem, TSummary> = {
    defaults: defaults.asReadonly(),
    request: request.asReadonly(),
    criteria,
    items: items.asReadonly(),
    totalCount: totalCount.asReadonly(),
    summary: summary.asReadonly(),
    message: message.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    searched: searched.asReadonly(),
    pageNumber,
    pageSize,
    sort,
    totalPages: computed(() => Math.ceil(totalCount() / pageSize())),
    hasItems: computed(() => items().length > 0),
    total: totalCount.asReadonly(),
    page: pageNumber,

    async init(): Promise<void> {
      loading.set(true);
      error.set(null);
      try {
        const d = await firstValueFrom(api.criteria<TCriteria>(endpoint));
        defaults.set(d);
        loading.set(false);
        await run({ ...d, ...(initialCriteria?.() ?? {}) });
      } catch (err) {
        loading.set(false);
        fail(err);
      }
    },

    search(next: Partial<TCriteria>): Promise<void> {
      const base = current();
      if (!base) return store.init();
      return run({ ...base, ...next, pageNumber: 1 });
    },

    reset(): Promise<void> {
      const d = defaults();
      return d ? run({ ...d }) : store.init();
    },

    setPage(page: number, size = pageSize()): Promise<void> {
      const base = current();
      if (!base) return Promise.resolve();
      return run({ ...base, pageSize: size, pageNumber: size === base.pageSize ? page : 1 });
    },

    sortBy(next: DataTableSort | null): Promise<void> {
      const base = current();
      if (!base) return Promise.resolve();
      return run({
        ...base,
        pageNumber: 1,
        orderByColumnName: next?.key ?? '',
        ascending: next ? next.dir === 'asc' : true,
      });
    },

    reload(): Promise<void> {
      const base = current();
      return base ? run({ ...base }) : store.init();
    },
  };

  if (autoInit) void store.init();
  return store;
}
