import { Signal, WritableSignal, computed, linkedSignal, signal } from '@angular/core';
import { ColumnDef, FilterState, SelectionMode, SortState, TrackByFn } from './smart-table.types';

export interface SmartTableStoreOptions<T> {
  rows: Signal<readonly T[]>;
  columns: Signal<readonly ColumnDef<T>[]>;
  trackBy?: Signal<TrackByFn<T>>;
  selectionMode?: Signal<SelectionMode>;
  /** Pass writable signals (e.g. component models) to share state with the caller. */
  search?: WritableSignal<string>;
  filters?: WritableSignal<FilterState>;
  sort?: WritableSignal<SortState>;
  pageSize?: WritableSignal<number>;
}

/** `null` marks an ellipsis in the page list. */
export type PageItem = number | null;

const defaultTrackBy = <T>(row: T): unknown => (row as { id?: unknown }).id ?? row;

/**
 * Signal-based state for SmartTable: rows → filtered → sorted → paged, plus selection.
 * Every derived value is a computed() so nothing is recomputed by hand.
 */
export class SmartTableStore<T> {
  readonly search: WritableSignal<string>;
  readonly filters: WritableSignal<FilterState>;
  readonly sort: WritableSignal<SortState>;
  readonly pageSize: WritableSignal<number>;

  private readonly rows: Signal<readonly T[]>;
  private readonly columns: Signal<readonly ColumnDef<T>[]>;
  private readonly trackBy: Signal<TrackByFn<T>>;
  private readonly selectionMode: Signal<SelectionMode>;
  private readonly selectedKeys = signal<ReadonlySet<unknown>>(new Set());

  /** 1-based page; any change to the query sends the user back to page 1. */
  readonly page: WritableSignal<number>;

  constructor(options: SmartTableStoreOptions<T>) {
    this.rows = options.rows;
    this.columns = options.columns;
    this.trackBy = options.trackBy ?? signal<TrackByFn<T>>(defaultTrackBy);
    this.selectionMode = options.selectionMode ?? signal<SelectionMode>('none');
    this.search = options.search ?? signal('');
    this.filters = options.filters ?? signal<FilterState>({});
    this.sort = options.sort ?? signal<SortState>({ key: null, direction: 'asc' });
    this.pageSize = options.pageSize ?? signal(10);

    this.page = linkedSignal({
      source: () => [this.search(), this.filters(), this.sort(), this.pageSize()],
      computation: () => 1,
    });
  }

  // ---- derived rows ------------------------------------------------------

  readonly visibleColumns = computed(() => this.columns().filter((column) => !column.hidden));

  readonly filteredRows = computed<readonly T[]>(() => {
    const columns = this.columns();
    const activeFilters = Object.entries(this.filters()).filter(([, value]) => value !== '');
    const term = this.search().trim().toLowerCase();

    const filterColumns = activeFilters
      .map(([key, value]) => ({ column: columns.find((c) => c.key === key), value }))
      .filter((entry): entry is { column: ColumnDef<T>; value: string } => !!entry.column);

    if (!filterColumns.length && !term) return this.rows();

    return this.rows().filter((row) => {
      const matchesFilters = filterColumns.every(
        ({ column, value }) => String(this.valueOf(column, row) ?? '') === value
      );
      if (!matchesFilters) return false;
      if (!term) return true;
      return columns.some((column) => this.searchTextOf(column, row).includes(term));
    });
  });

  readonly sortedRows = computed<readonly T[]>(() => {
    const { key, direction } = this.sort();
    const column = key ? this.columns().find((c) => c.key === key) : undefined;
    if (!column) return this.filteredRows();

    const factor = direction === 'asc' ? 1 : -1;
    return [...this.filteredRows()].sort(
      (a, b) => compareValues(this.valueOf(column, a), this.valueOf(column, b)) * factor
    );
  });

  readonly total = computed(() => this.sortedRows().length);

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  readonly currentPage = computed(() => Math.min(Math.max(1, this.page()), this.pageCount()));

  readonly pageRows = computed<readonly T[]>(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });

  readonly rangeStart = computed(() =>
    this.total() ? (this.currentPage() - 1) * this.pageSize() + 1 : 0
  );

  readonly rangeEnd = computed(() => Math.min(this.currentPage() * this.pageSize(), this.total()));

  /** First, last and the neighbours of the current page, with gaps collapsed. */
  readonly pageItems = computed<PageItem[]>(() => {
    const total = this.pageCount();
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

    const current = this.currentPage();
    const pages = [...new Set([1, total, current - 1, current, current + 1])]
      .filter((n) => n >= 1 && n <= total)
      .sort((a, b) => a - b);

    return pages.flatMap((n, i) => (i > 0 && n - pages[i - 1] > 1 ? [null, n] : [n]));
  });

  // ---- selection ---------------------------------------------------------

  /** Selected rows that still exist in the current data set. */
  readonly selectedRows = computed<readonly T[]>(() => {
    const keys = this.selectedKeys();
    if (!keys.size) return [];
    const trackBy = this.trackBy();
    return this.rows().filter((row) => keys.has(trackBy(row)));
  });

  readonly selectedCount = computed(() => this.selectedRows().length);

  readonly allPageSelected = computed(() => {
    const rows = this.pageRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  });

  readonly somePageSelected = computed(
    () => !this.allPageSelected() && this.pageRows().some((row) => this.isSelected(row))
  );

  isSelected(row: T): boolean {
    return this.selectedKeys().has(this.trackBy()(row));
  }

  toggleRow(row: T): void {
    const mode = this.selectionMode();
    if (mode === 'none') return;

    const key = this.trackBy()(row);
    this.selectedKeys.update((keys) => {
      if (keys.has(key)) {
        const next = new Set(keys);
        next.delete(key);
        return next;
      }
      return mode === 'single' ? new Set([key]) : new Set(keys).add(key);
    });
  }

  togglePage(): void {
    if (this.selectionMode() !== 'multiple') return;

    const trackBy = this.trackBy();
    const pageKeys = this.pageRows().map(trackBy);
    const selectAll = !this.allPageSelected();

    this.selectedKeys.update((keys) => {
      const next = new Set(keys);
      for (const key of pageKeys) {
        if (selectAll) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  clearSelection(): void {
    this.selectedKeys.set(new Set());
  }

  // ---- commands ----------------------------------------------------------

  toggleSort(key: string): void {
    const current = this.sort();
    if (current.key !== key) this.sort.set({ key, direction: 'asc' });
    else if (current.direction === 'asc') this.sort.set({ key, direction: 'desc' });
    else this.sort.set({ key: null, direction: 'asc' });
  }

  setFilter(key: string, value: string): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
  }

  goToPage(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.pageCount()));
  }

  // ---- values ------------------------------------------------------------

  valueOf(column: ColumnDef<T>, row: T): unknown {
    return column.value ? column.value(row) : (row as Record<string, unknown>)[column.key];
  }

  display(column: ColumnDef<T>, row: T): string {
    const value = this.valueOf(column, row);
    return column.format ? column.format(value, row) : String(value ?? '');
  }

  /** CSV of every filtered + sorted row (not just the current page). */
  toCsv(): string {
    const columns = this.columns().filter((column) => column.exportable !== false);
    const header = columns.map((column) => csvCell(column.header));
    const body = this.sortedRows().map((row) =>
      columns.map((column) => csvCell(this.display(column, row)))
    );
    return [header, ...body].map((cells) => cells.join(',')).join('\r\n');
  }

  private searchTextOf(column: ColumnDef<T>, row: T): string {
    return (column.searchText ? column.searchText(row) : this.display(column, row)).toLowerCase();
  }
}

const compareValues = (a: unknown, b: unknown): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

const csvCell = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
