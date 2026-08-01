/**
 * createListStore — factory for a reusable paginated list store.
 *
 * Wires the common list-view state machine (query, filters, page, pageSize,
 * loading, error) to an async loader and exposes read-only computed signals
 * for templates. Every IAM admin list page (resources, roles, groups, users)
 * uses the same shape so the data-table/filter-bar components can be shared.
 *
 * Usage:
 *   export const resourcesStore = createListStore<ResourceListItem>({
 *     loader: (params) => api.list(params),           // returns PaginatedList<T>
 *   });
 *
 * The loader must return the raw PaginatedList<T> (the api layer unwraps the
 * ApiEnvelope). Signals:
 *   items, meta, loading, error, q, filters, page, pageSize
 * Methods:
 *   setQ, setFilters, setPage, setPageSize, reload, reset
 */
import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PaginatedList } from '@shared/models/iam.model';

export interface ListQuery {
  q?: string;
  page: number;
  pageSize: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ListStoreOptions<T> {
  /** Async loader returning the paginated page. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loader: (query: ListQuery) => Promise<PaginatedList<T>> | import('rxjs').Observable<PaginatedList<T>>;
  initialPageSize?: number;
  /** Keys copied from filter state into the loader query. */
  filterKeys?: string[];
  /** Load immediately on construction. */
  autoLoad?: boolean;
}

export interface ListStore<T> {
  readonly items: ReturnType<typeof computed<T[]>>;
  readonly meta: ReturnType<typeof computed<PaginatedList<T>['meta'] | null>>;
  readonly loading: ReturnType<typeof computed<boolean>>;
  readonly error: ReturnType<typeof computed<string | null>>;
  readonly q: ReturnType<typeof computed<string>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly filters: ReturnType<typeof computed<Record<string, any>>>;
  readonly page: ReturnType<typeof computed<number>>;
  readonly pageSize: ReturnType<typeof computed<number>>;
  readonly total: ReturnType<typeof computed<number>>;
  readonly totalPages: ReturnType<typeof computed<number>>;
  readonly hasItems: ReturnType<typeof computed<boolean>>;

  setQ(q: string): void;
  setPage(page: number): void;
  setPageSize(size: number): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFilters(filters: Record<string, any>): void;
  reload(): Promise<void>;
  reset(): void;
}

export function createListStore<T>(options: ListStoreOptions<T>): ListStore<T> {
  const {
    loader,
    initialPageSize = 20,
    filterKeys = [],
    autoLoad = true,
  } = options;

  const q = signal('');
  const filters = signal<Record<string, unknown>>({});
  const page = signal(1);
  const pageSize = signal(initialPageSize);
  const items = signal<T[]>([]);
  const meta = signal<PaginatedList<T>['meta'] | null>(null);
  const loading = signal(false);
  const error = signal<string | null>(null);

  async function runLoader(): Promise<void> {
    loading.set(true);
    error.set(null);
    try {
      const query: ListQuery = { q: q(), page: page(), pageSize: pageSize() };
      for (const key of filterKeys) {
        const value = filters()[key];
        if (value !== undefined && value !== null && value !== '') {
          query[key] = value;
        }
      }
      const result = loader(query);
      const list =
        result instanceof Promise
          ? await result
          : await firstValueFrom(result);
      items.set(list.data);
      meta.set(list.meta);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = (err as any)?.error?.error?.message ?? 'Failed to load items.';
      error.set(message);
    } finally {
      loading.set(false);
    }
  }

  if (autoLoad) {
    void runLoader();
  }

  return {
    items: computed(() => items()),
    meta: computed(() => meta()),
    loading: computed(() => loading()),
    error: computed(() => error()),
    q: computed(() => q()),
    filters: computed(() => filters()),
    page: computed(() => page()),
    pageSize: computed(() => pageSize()),
    total: computed(() => meta()?.total ?? 0),
    totalPages: computed(() => meta()?.totalPages ?? 0),
    hasItems: computed(() => items().length > 0),

    setQ(value: string): void {
      q.set(value);
      page.set(1);
      void runLoader();
    },
    setPage(value: number): void {
      page.set(value);
      void runLoader();
    },
    setPageSize(size: number): void {
      pageSize.set(size);
      page.set(1);
      void runLoader();
    },
    setFilters(next: Record<string, unknown>): void {
      filters.set(next);
      page.set(1);
      void runLoader();
    },
    reload(): Promise<void> {
      return runLoader();
    },
    reset(): void {
      q.set('');
      filters.set({});
      page.set(1);
      items.set([]);
      meta.set(null);
      error.set(null);
    },
  };
}
