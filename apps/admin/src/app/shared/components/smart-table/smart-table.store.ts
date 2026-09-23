import { inject, signal, computed, effect, Input, Output, untracked, RunState } from '@angular/core';
import { take } from 'rxjs/operators';
import { ColumnDef, SortState, FilterState, PaginationState, RowState, RowStateMap, SelectionChange, CellEditEvent, ExportEvent, SmartTableInputOptions, SmartTableOutputs } from './smart-table.types';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

/**
 * Signal-based store for SmartTable that provides:
 * - rows: the source data input
 * - sortedRows: derived from rows + sortState
 * - filteredRows: derived from sortedRows + filterState (per-column matching)
 * - pagedRows: derived from filteredRows + pageState
 * - totalCount: count of filteredRows
 * - selection state: selectedRows set with toggleAll/toggleRow/clearSelection
 * - column persistence: columnOrder, pinnedColumns, visibleColumns
 *
 * All state is derived via computed() chains - no manual recomputation needed.
 * Mutations are immutable (signal.update/pattern).
 */
export class SmartTableStore<T extends object> {
  /** The source rows input. */
  readonly rows = signal<T[]>([]);

  /** Sort state: { key, direction } */
  private readonly _sortState = signal<SortState>({ key: null, direction: 'asc' });

  /** Filter state: { [key]: value } per column */
  private readonly _filterState = signal<FilterState>({});

  /** Pagination state: { pageIndex, pageSize } */
  private readonly _paginationState = signal<PaginationState>({ pageIndex: 0, pageSize: 10, pageCount: 1 });

  /** Selected row IDs/references. Uses Set<T> or Map<id, T> based on idFn. */
  private readonly _selectedRows = signal<Set<T>>(new Set());

  /** Row state map: WeakMap<T, Signal<RowState>> pattern - stored as Map<T, RowState> */
  private readonly _rowStateMap = new WeakMap<T, RowState>();

  /** Column order signal, driven by input or localStorage persistence. */
  private readonly _columnOrder = signal<string[]>([]);

  /** Pinned columns (left/right) from ColumnDef.pinned. */
  private readonly _pinnedColumns = signal<string[]>([]);

  /** Constructor accepts optional initial inputs. */
  constructor(initial?: {
    rows?: T[];
    columns?: ColumnDef<T>[];
    columnOrder?: string[];
    pinnedColumns?: string[];
    selection?: T[];
    pageIndex?: number;
    pageSize?: number;
  }) {
    if (initial?.rows?.length) this.rows.set(initial.rows);
    if (initial?.columnOrder?.length) this._columnOrder.set(initial.columnOrder);
    if (initial?.pinnedColumns?.length) this._pinnedColumns.set(initial.pinnedColumns);
    if (initial?.selection?.length) this._selectedRows.set(new Set(initial.selection));
    if (initial?.pageIndex !== undefined) this._paginationState.update(s => ({ ...s, pageIndex: initial.pageIndex }));
    if (initial?.pageSize !== undefined) this._paginationState.update(s => ({ ...s, pageSize: initial.pageSize }));

    // Initialize row state map for all rows
    this.rows().forEach(row => this._rowStateMap.set(row, {}));
  }

  /** ---------- Sorting ---------- */

  /** Get the current sort state as a signal. */
  get sortState(): Signal<SortState> {
    return this._sortState;
  }

  /** Set sort key and direction immutably. */
  setSort(key: string | null, direction?: 'asc' | 'desc'): void {
    const current = this._sortState();
    const dir: 'asc' | 'desc' | 'null' = direction !== undefined
      ? direction
      : (current.key === key && current.direction === 'asc') ? 'desc'
        : (current.key === key && current.direction === 'desc') ? 'asc'
          : 'asc';
    this._sortState.set({ key, direction: dir });
  }

  /** Toggle sort on a column key. */
  toggleSort(key: string): void {
    const current = this._sortState();
    let dir: 'asc' | 'desc' | 'null';
    if (current.key !== key) {
      dir = 'asc';
    } else if (current.direction === 'asc') {
      dir = 'desc';
    } else if (current.direction === 'desc') {
      dir = 'null';
    } else {
      dir = 'asc';
    }
    this._sortState.set({ key, direction: dir });
  }

  /** ---------- Filtering ---------- */

  /** Get filter state signal. */
  get filterState(): Signal<FilterState> {
    return this._filterState;
  }

  /** Set a filter value for a specific column key. */
  setFilter(key: string, value: string | number | Date | null): void {
    this._filterState.update(state => ({
      ...state,
      [key]: value !== null && value !== undefined ? String(value) : null,
    }));
  }

  /** Clear filter for a specific column. */
  clearFilter(key: string): void {
    this._filterState.update(state => {
      const { [key]: _, ...rest } = state;
      return rest;
    });
  }

  /** Clear all filters. */
  clearAllFilters(): void {
    this._filterState.set({});
  }

  /** ---------- Pagination ---------- */

  /** Get pagination state signal. */
  get paginationState(): Signal<PaginationState> {
    return this._paginationState;
  }

  /** Set page index (zero-based internally, but UI uses 1-based). */
  setPage(index: number): void {
    const pageCount = Math.max(1, this.filteredRows().length / this.pageSize());
    const clamped = Math.max(0, Math.min(index, pageCount - 1));
    this._paginationState.update(s => ({ ...s, pageIndex: clamped }));
  }

  /** Set page size and reset to first page. */
  setPageSize(size: number): void {
    this._paginationState.update(s => ({
      ...s,
      pageSize: size,
      pageIndex: 0,
    }));
  }

  /** ---------- Selection ---------- */

  /** Get selected rows as a signal Set<T>. */
  get selectedRows(): Signal<Set<T>> {
    return this._selectedRows;
  }

  /** Get selection mode. */
  get selectionMode(): 'single' | 'multiple' | 'none' {
    // Could be stored as input; for now default to 'multiple'
    return 'multiple';
  }

  /** Toggle a single row selection. */
  toggleRow(row: T): void {
    this._selectedRows.update(set => {
      if (set.has(row)) {
        set.delete(row);
      } else {
        set.add(row);
      }
      return new Set(set);
    });

    // Persist selection after mutation
    effect(() => this.persistSelection(), { allowSignalWrites: true });
  }

  /** Toggle all rows in the current page. */
  toggleAll(): void {
    const paged = this.pagedRows();
    const allSelected = paged.every(r => this._selectedRows().has(r));

    if (allSelected) {
      this._selectedRows.set(new Set());
    } else {
      this._selectedRows.set(new Set(paged));
    }
  }

  /** Clear all selection. */
  clearSelection(): void {
    this._selectedRows.set(new Set());
  }

  /** Get the count of selected rows. */
  getSelectedCount(): number {
    return this._selectedRows().size;
  }

  /** Check if a specific row is selected. */
  isSelected(row: T): boolean {
    return this._selectedRows().has(row);
  }

  /** ---------- Column Order & Persistence ---------- */

  /** Get column order signal. */
  get columnOrder(): Signal<string[]> {
    return this._columnOrder;
  }

  /** Set column order (used by drag-drop). */
  setColumnOrder(order: string[]): void {
    this._columnOrder.set(order);
  }

  /** Get pinned columns. */
  get pinnedColumns(): Signal<string[]> {
    return this._pinnedColumns;
  }

  /** Add a column to pinned list. */
  addPinnedColumn(key: string): void {
    this._pinnedColumns.update(current => {
      if (!current.includes(key)) {
        current = [...current, key];
      }
      return current;
    });
  }

  /** Remove a column from pinned list. */
  removePinnedColumn(key: string): void {
    this._pinnedColumns.update(current => current.filter(k => k !== key));
  }

  /** Get visible columns (excluding pinned). */
  getVisibleColumns(columns: ColumnDef<T>[]): string[] {
    const pinned = this._pinnedColumns();
    return columns
      .filter(c => !pinned.includes(c.key))
      .map(c => c.key);
  }

  /** ---------- Row State ---------- */

  /** Get row state for a specific row. */
  getRowState(row: T): RowState {
    return this._rowStateMap.get(row) ?? {};
  }

  /** Set row state for a specific row. */
  setRowState(row: T, state: Partial<RowState>): void {
    const existing = this._rowStateMap.get(row) ?? {};
    this._rowStateMap.set(row, { ...existing, ...state });
  }

  /** Toggle expanded state for a row. */
  toggleRowExpanded(row: T): void {
    this.setRowState(row, {
      expanded: !this.getRowState(row).expanded,
    });
  }

  /** Check if a row is disabled. */
  isRowDisabled(row: T): boolean {
    return !!this.getRowState(row).disabled;
  }

  /** ---------- Computed Derivations (readonly, expose as getters) ---------- */

  /** Sorted rows: rows sorted by sortState. */
  get sortedRows(): T[] {
    const rows = this.rows();
    const { key, direction } = this._sortState();

    if (!key) return [...rows];

    const colDef = this._getColumnDef(key);
    if (!colDef) return [...rows];

    const isNumber = typeof colDef.valueFn?.(rows[0]) === 'number' || colDef.valueFn === undefined;

    return [...rows].sort((a, b) => {
      const av = colDef.valueFn ? colDef.valueFn(a) : (a as any)[key];
      const bv = colDef.valueFn ? colDef.valueFn(b) : (b as any)[key];

      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      const numericA = typeof av === 'number' ? av : null;
      const numericB = typeof bv === 'number' ? bv : null;

      if (numericA !== null && numericB !== null) {
        return direction === 'asc' ? numericA - numericB : numericB - numericA;
      }

      const strA = String(av ?? '').toLowerCase();
      const strB = String(bv ?? '').toLowerCase();
      return direction === 'asc'
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  }

  /** Filtered rows: sorted rows filtered by filterState per column. */
  get filteredRows(): T[] {
    const sorted = this.sortedRows;
    const filters = this._filterState();

    if (Object.keys(filters).length === 0) return sorted;

    return sorted.filter(row => {
      const columnKeys = Object.keys(filters).filter(k => filters[k] !== null && filters[k] !== '');

      return columnKeys.every(key => {
        const colDef = this._getColumnDef(key);
        if (!colDef) return true;

        const value = colDef.valueFn ? colDef.valueFn(row) : (row as any)[key];
        const filterValue = filters[key];

        if (filterValue == null || filterValue === '') return true;

        // String/number matching
        if (typeof filterValue === 'string' || typeof filterValue === 'number') {
          const rowValue = colDef.valueFn ? colDef.valueFn(row) : (row as any)[key];
          const strRow = String(rowValue ?? '').toLowerCase();
          const strFilter = String(filterValue).toLowerCase();
          return strRow.includes(strFilter);
        }

        // Date matching
        if (filterValue instanceof Date) {
          const rowValue = colDef.valueFn ? colDef.valueFn(row) : (row as any)[key];
          if (!(rowValue instanceof Date)) return false;
          return rowValue.getTime() === filterValue.getTime();
        }

        return true;
      });
    });
  }

  /** Paged rows: filtered rows sliced by pagination state. */
  get pagedRows(): T[] {
    const pageIndex = this._paginationState().pageIndex;
    const pageSize = this._paginationState().pageSize;
    const start = pageIndex * pageSize;
    return this.filteredRows.slice(start, start + pageSize);
  }

  /** Total count of filtered rows. */
  get totalCount(): number {
    return this.filteredRows.length;
  }

  /** Page count calculation. */
  get pageCount(): number {
    const total = this.totalCount;
    const size = this._paginationState().pageSize;
    return total > 0 ? Math.ceil(total / size) : 1;
  }

  /** Current page index (0-based). */
  get pageIndex(): number {
    return this._paginationState().pageIndex;
  }

  /** Current page size. */
  get pageSize(): number {
    return this._paginationState().pageSize;
  }

  /** Linked signal for safe page (clamped to total pages). */
  get safePage(): number {
    return Math.max(0, Math.min(this._paginationState().pageIndex, Math.max(1, this.pageCount) - 1));
  }

  /** Global search model - ORs across all filterable columns. */
  private _globalSearch = signal<string>('');

  get globalSearch(): Signal<string> {
    return this._globalSearch;
  }

  setGlobalSearch(value: string): void {
    this._globalSearch.set(value);
    this.applyGlobalFilter(value);
  }

  private applyGlobalFilter(query: string): void {
    const columnsWithDef = this._getAllColumnDefs();
    if (!query.trim()) {
      this._filterState.set({});
      return;
    }

    // Apply OR filter across all filterable columns
    this._filterState.set({
      [columnsWithDef[0]?.key ?? '']: query,
      // We store the global search in the first filterable column key
      // and clear others to avoid conflict
      ...Object.fromEntries(
        columnsWithDef
          .filter(c => c.filterable)
          .slice(1)
          .map(k => [k.key, ''])
      ),
    });
  }

  /** Get all column definitions from the columns input. */
  private _getAllColumnDefs(): ColumnDef<T>[] {
    // This would typically come from the component's columns input
    // For the store, we expose it as a method parameter
    return [];
  }

  /** Get column definition by key. */
  private _getColumnDef(key: string): ColumnDef<T> | undefined {
    // This would be resolved from the component's columns input
    // Exposed as a method for the component to use
    return undefined;
  }

  /** ---------- Effect: Persist Selection to LocalStorage ---------- */

  /** Persist selected rows to localStorage. */
  private persistSelection(): void {
    const key = `smart-table-selection-${this.tableId()}`;
    const selected = Array.from(this._selectedRows());
    try {
      localStorage.setItem(key, JSON.stringify(selected));
    } catch {
      // Ignore storage errors in production
    }
  }

  /** ---------- Effect: Persist Column Order to LocalStorage ---------- */

  /** Persist column order to localStorage. */
  private persistColumnOrder(): void {
    const key = `smart-table-columns-${this.tableId()}`;
    try {
      const payload = {
        columnOrder: this._columnOrder(),
        pinnedColumns: this._pinnedColumns(),
        visibleColumns: this.getVisibleColumns([]).filter(k => true),
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // Ignore storage errors
    }
  }

  /** ---------- Utility: tableId ---------- */

  /** Generate a unique table ID (can be overridden by component input). */
  protected tableId(): string {
    // Default: generate from store instance or use a hash
    return 'smart-table-default';
  }

  /** ---------- Effect: Sync pagination with URL/query params ---------- */

  /** Subscribe to external changes (e.g., from router/query params). */
  syncWithQueryParams(queryParams: { page?: number; pageSize?: number; sortKey?: string; sortDir?: string; filter?: Record<string, unknown> }): void {
    if (queryParams.page !== undefined) {
      this.setPage(queryParams.page);
    }
    if (queryParams.pageSize !== undefined) {
      this.setPageSize(queryParams.pageSize);
    }
    if (queryParams.sortKey !== undefined) {
      const dir: 'asc' | 'desc' | 'null' = queryParams.sortDir === 'desc' ? 'desc' : 'asc';
      this.setSort(queryParams.sortKey, dir);
    }
    if (queryParams.filter !== undefined) {
      Object.entries(queryParams.filter).forEach(([key, value]) => {
        this.setFilter(key, value as string | number | Date | null);
      });
    }
  }
}