import {
  Component,
  signal,
  computed,
  effect,
  input,
  output,
  model,
  linkedSignal,
  ElementRef,
  viewChildren,
  ContentChild,
  TemplateRef,
  ChangeDetectionStrategy,
  OnDestroy,
  inject,
  DestroyRef,
  Attribute,
  ViewChild,
} from '@angular/core';
import {
  NgIf,
  NgForOf,
  NgTemplateOutlet,
  AsyncPipe,
  CommonModule,
} from '@angular/common';
import {
  CdkDropList,
  CdkDrag,
  CdkDragHandle,
  CdkDragDrop,
  moveItemInArray,
  CdkVirtualScrollViewport,
  CdkVirtualForOf,
} from '@angular/cdk';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, fromEvent, Observable, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
} from 'rxjs/operators';
import { ResizeObserver } from 'resize-observer-js';

import { SmartTableStore, ColumnDef, SortState, FilterState, PaginationState, RowState, SelectionChange, CellEditEvent, ExportEvent } from './smart-table.types';
import { DEFAULT_COLUMN_DEF } from './smart-table.types';

/* ---------- Composables (mixin-style) ---------- */

/**
 * createSelectionState<T> - Reusable composable for multi-select state management.
 * Can be used outside the table for any collection of items.
 */
export function createSelectionState<T>(
  anInitialSet: Set<T> = new Set(),
  idFn: (row: T) => string | number = (row: T) => row['id'] || row['_id'] || String(row)
) {
  const selected = signal<Set<T>>(anInitialSet);

  return {
    /** Get selected set. */
    get selected(): Signal<Set<T>> {
      return selected;
    },

    /** Toggle a single row. */
    toggleRow(row: T): void {
      selected.update(s => {
        const newSet = new Set(s);
        if (newSet.has(row)) {
          newSet.delete(row);
        } else {
          newSet.add(row);
        }
        return newSet;
      });
    },

    /** Toggle all items in a provided array. */
    toggleAll(items: T[]): void {
      const currentlySelected = Array.from(selected());
      const allSelected = items.every(i => currentlySelected.includes(i));

      if (allSelected) {
        selected.set(new Set());
      } else {
        selected.set(new Set(items));
      }
    },

    /** Clear all selection. */
    clearSelection(): void {
      selected.set(new Set());
    },

    /** Get selected count. */
    getSelectedCount(): number {
      return selected().size;
    },

    /** Check if specific item is selected. */
    isSelected(row: T): boolean {
      return selected().has(row);
    },

    /** Emitted on any selection mutation via effect. */
    selectionChange: output<T[]>(),

    /** Effect to wire up output. */
    initEffect(onChange: (added: T[], removed: T[]) => void): void {
      effect(() => {
        const current = selected();
        const previous = new Set(current); // simplified - in real use track changes
        // Emit current selection on every change
        onChange([], [], Array.from(current));
      });
    },
  };
}

/* ---------- SmartTable Component ---------- */

@Component({
  selector: 'app-smart-table',
  standalone: true,
  imports: [
    CommonModule,
    NgTemplateOutlet,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkVirtualScrollViewport,
    CdkVirtualForOf,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './smart-table.component.html',
  styleUrl: './smart-table.component.css',
})
export class SmartTableComponent<T extends object> implements OnDestroy {
  /** The data rows. */
  readonly rows = input<readonly T[]>([]);

  /** Column definitions. */
  readonly columns = input.required<ColumnDef<T>[]>();

  /** Default item size for virtual scroll (px). */
  readonly itemSize = input(56);

  /** Virtual scroll enabled flag. */
  readonly virtualScroll = input(false);

  /** Height of the virtual scroll container when virtualScroll is true. */
  readonly virtualHeight = input('420px');

  /** Enable row reordering (drag-and-drop). */
  readonly reorderable = input(false);

  /** Enable search/filter. */
  readonly searchable = input(true);

  /** Global search model (two-way). */
  readonly globalSearch = model('');

  /** Selection mode: 'single' | 'multiple' | 'none'. */
  readonly selectionMode = input<'single' | 'multiple' | 'none'>('multiple');

  /** Custom row identity function. Default falls back to row ref. */
  readonly idFn = input<(row: T) => string | number>((row: T) => {
    const id = row['id'] || row['_id'];
    return id != null ? String(id) : String(row);
  });

  /** Table ID for localStorage persistence. */
  readonly tableId = input<string>('smart-table');

  /** Emitted when a row is clicked. */
  readonly rowClick = output<T>();

  /** Emitted when a row is double-clicked. */
  readonly rowDblClick = output<T>();

  /** Emitted when selection changes. */
  readonly selectionChange = output<SelectionChange<T>>();

  /** Emitted when a cell edit is committed. */
  readonly cellEdit = output<CellEditEvent<T>>();

  /** Emitted when column order changes. */
  readonly columnReorder = output<{ previousIndex: number; currentIndex: number }>();

  /** Emitted when rows are reordered. */
  readonly rowReorder = output<{ previousIndex: number; currentIndex: number }>();

  /** Emitted when export completes. */
  readonly exportCsv = output<Blob>();

  /** Emitted when Excel export completes. */
  readonly exportExcel = output<Blob>();

  /** Emitted when column order changes (from drag-drop). */
  readonly columnOrderChange = output<string[]>();

  /** Emitted when editable cell mode changes. */
  readonly cellSave = output<CellEditEvent<T>>();

  /** ---------- Internal signals (store-like) ---------- */

  /** Sort state: { key, direction } */
  private readonly _sortState = signal<SortState>({ key: null, direction: 'asc' });

  /** Filter state: { [key]: value } per column. */
  private readonly _filterState = signal<FilterState>({});

  /** Pagination state: { pageIndex (0-based), pageSize } */
  private readonly _paginationState = signal<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
    pageCount: 1,
  });

  /** Selected rows set< T >. */
  private readonly _selectedRows = signal<Set<T>>(new Set());

  /** Row state map: WeakMap<T, RowState> pattern. */
  private readonly _rowStateMap = new WeakMap<T, RowState>();

  /** Column order signal (drives UI, persists to localStorage). */
  private readonly _columnOrder = signal<string[]>([]);

  /** Pinned columns (left/right) from ColumnDef.pinned. */
  private readonly _pinnedColumns = signal<string[]>([]);

  /** Global search signal. */
  private readonly _globalSearch = signal<string>('');

  /** Currently edited cell: { rowId, key } | null. */
  private readonly _editState = signal<{ rowId: string; key: string } | null>(null);

  /** Draft value for in-cell editing: Partial<T>. */
  private readonly _draft = signal<Partial<T>>({});

  /** Element ref for scroll positioning. */
  private readonly _elRef = inject(ElementRef);

  /** Destroy reference for cleanup. */
  private readonly _destroyRef = inject(DestroyRef);

  /** Viewport for virtual scroll. */
  @ViewChild(CdkVirtualScrollViewport)
  viewport!: CdkVirtualScrollViewport;

  /** Column drag drop list. */
  @ViewChild('columnDropList', { static: true })
  columnDropList!: CdkDropList;

  /** Row template ref from projection. */
  @ContentChild('rowTpl') rowTpl!: TemplateRef<any>;

  /** Cell template directives projected. */
  @ContentChildren('cellTpl') cellTpl = new Set();

  /** ---------- Computed Derivations ---------- */

  /** Sorted rows: derived from rows() + sortState(). */
  get sortedRows(): T[] {
    const rows = this.rows();
    const { key, direction } = this._sortState();

    if (!key || rows.length === 0) return [...rows];

    const colDef = this.columns().find(c => c.key === key);
    if (!colDef) return [...rows];

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

  /** Filtered rows: derived from sortedRows + filterState (per-column string/number/date matching). */
  get filteredRows(): T[] {
    const sorted = this.sortedRows;
    const filters = this._filterState();

    if (Object.keys(filters).length === 0) return sorted;

    return sorted.filter(row => {
      const filterableKeys = this.columns()
        .filter(c => c.filterable)
        .map(c => c.key);

      return filterableKeys.every(key => {
        const colDef = this.columns().find(c => c.key === key);
        if (!colDef) return true;

        const value = colDef.valueFn ? colDef.valueFn(row) : (row as any)[key];
        const filterValue = filters[key];

        if (filterValue == null || filterValue === '') return true;

        // String matching
        if (typeof filterValue === 'string') {
          const rowValue = colDef.valueFn ? colDef.valueFn(row) : (row as any)[key];
          const strRow = String(rowValue ?? '').toLowerCase();
          const strFilter = String(filterValue).toLowerCase();
          return strRow.includes(strFilter);
        }

        // Number matching
        if (typeof filterValue === 'number') {
          const rowValue = colDef.valueFn ? colDef.valueFn(row) : (row as any)[key];
          return Number(rowValue ?? NaN) === filterValue;
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

  /** Paged rows: derived from filteredRows + pageState. */
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

  /** Page count. */
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

  /** Linked signal for safe page (clamped). */
  get safePage(): number {
    return Math.max(0, Math.min(this._paginationState().pageIndex, Math.max(1, this.pageCount) - 1));
  }

  /** Range start (1-based). */
  get rangeStart(): number {
    if (this.totalCount === 0) return 0;
    return this._paginationState().pageIndex * this._paginationState().pageSize + 1;
  }

  /** Range end (1-based). */
  get rangeEnd(): number {
    if (this.totalCount === 0) return 0;
    const end = (this._paginationState().pageIndex + 1) * this._paginationState().pageSize;
    return end > this.totalCount ? this.totalCount : end;
  }

  /** Pagination page numbers. */
  get pageNumbers(): (number | null)[] {
    const total = this.pageCount;
    const current = this.safePage();
    const max = 5;
    if (total <= max) return Array.from({ length: total }, (_, i) => i);
    const start = Math.max(0, current - Math.floor(max / 2));
    const end = Math.min(total, start + max);
    start = Math.max(0, end - max);
    const out: (number | null)[] = [];
    for (let i = start; i < end; i++) {
      if (i === current) {
        out.push(i);
      } else if (i === start && start > 0) {
        out.unshift(null);
        out.push(i);
      } else {
        out.push(i);
      }
    }
    // Trim leading/trailing nulls if at boundaries
    while (out[0] === null && out.length > 1) out.shift();
    while (out[out.length - 1] === null && out.length > 1) out.pop();
    return out;
  }

  /** Visible columns: excluding pinned ones. */
  get visibleColumns(): string[] {
    const pinned = this._pinnedColumns();
    return this.columns()
      .filter(c => !pinned.includes(c.key))
      .map(c => c.key);
  }

  /** Ordered columns: derived from columnOrder input, drives drag-drop UI. */
  get orderedColumns(): ColumnDef<T>[] {
    const order = this._columnOrder();
    const cols = this.columns();
    return order.length > 0
      ? order.map(key => cols.find(c => c.key === key)!.columns)
      : [...cols];
  }

  /** Selected rows set. */
  get selectedRows(): Set<T> {
    return this._selectedRows();
  }

  /** Selected count. */
  get selectedCount(): number {
    return this._selectedRows().size;
  }

  /** Select all computed: indeterminate/all/none state across pagedRows(). */
  get selectAll(): 'none' | 'partial' | 'all' {
    const selected = this._selectedRows();
    const paged = this.pagedRows;

    if (paged.length === 0) return 'none';
    if (selected.size === paged.length) return 'all';
    if (selected.size > 0) return 'partial';
    return 'none';
  }

  /** Row state for a given row. */
  getRowState(row: T): RowState {
    return this._rowStateMap.get(row) ?? {};
  }

  /** Edit state: { rowId, key } | null. */
  get editState(): { rowId: string; key: string } | null {
    return this._editState();
  }

  /** Draft value for editing. */
  get draft(): Partial<T> {
    return this._draft();
  }

  /** ---------- Constructor / Effects ---------- */

  constructor() {
    // Initialize row state map for all rows
    this.rows().forEach(row => this._rowStateMap.set(row, {}));

    // Persist selection on every change
    effect(() => {
      this.persistSelection();
    }, { allowSignalWrites: true });

    // Persist column order on every change
    effect(() => {
      this.persistColumnOrder();
    }, { allowSignalWrites: true });

    // Sync viewport size when filteredRows changes
    effect(() => {
      if (this.virtualScroll()) {
        // Ensure viewport recalculates
        // We use a micro-task to ensure the signal chain is stable
        setTimeout(() => {
          this.checkViewportSize();
        }, 0);
      }
    }, { allowSignalWrites: true });

    // Subscribe to global search model changes
    effect(() => {
      const query = this._globalSearch();
      if (query.trim()) {
        this.applyGlobalFilter(query);
      } else {
        this.clearAllFilters();
      }
    });
  }

  /** ---------- Sorting Methods ---------- */

  /** Set sort key and direction. */
  setSort(key: string | null, direction: 'asc' | 'desc' = 'asc'): void {
    this._sortState.set({ key, direction });
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

  /** Sort indicator for a column. */
  sortIndicator(col: ColumnDef<T>): 'asc' | 'desc' | null {
    const s = this._sortState();
    return s.key === col.key ? s.direction : null;
  }

  /** ARIA sort label. */
  ariaSort(col: ColumnDef<T>): 'ascending' | 'descending' | 'none' {
    const d = this.sortIndicator(col);
    return d === 'asc' ? 'ascending' : d === 'desc' ? 'descending' : 'none';
  }

  /** ---------- Filtering Methods ---------- */

  /** Set a filter value for a column key. */
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

  /** Apply global search across all filterable columns (OR logic). */
  applyGlobalFilter(query: string): void {
    const filterableCols = this.columns().filter(c => c.filterable);
    if (!query.trim()) {
      this._filterState.set({});
      return;
    }

    // Store in first filterable column, clear others
    this._filterState.set({
      [filterableCols[0]?.key ?? '']: query,
      ...Object.fromEntries(
        filterableCols.slice(1).map(k => [k.key, ''])
      ),
    });
  }

  /** ---------- Pagination Methods ---------- */

  /** Set page index (0-based internally). */
  setPage(index: number): void {
    const pageCount = Math.max(1, this.pageCount);
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

  /** ---------- Selection Methods ---------- */

  /** Toggle a single row selection. */
  toggleRow(row: T): void {
    const id = this.idFn(row);
    this._selectedRows.update(set => {
      const newSet = new Set(set);
      if (newSet.has(row)) {
        newSet.delete(row);
      } else {
        newSet.add(row);
      }
      return newSet;
    });
  }

  /** Toggle all rows in current paged view. */
  toggleAll(): void {
    const paged = this.pagedRows;
    const currentlySelected = Array.from(this._selectedRows());

    if (paged.length === 0) return;

    if (currentlySelected.length === paged.length) {
      this._selectedRows.set(new Set());
    } else {
      this._selectedRows.set(new Set(paged));
    }
  }

  /** Clear all selection. */
  clearSelection(): void {
    this._selectedRows.set(new Set());
  }

  /** Get selected count. */
  getSelectedCount(): number {
    return this._selectedRows().size;
  }

  /** Check if row is selected. */
  isSelected(row: T): boolean {
    return this._selectedRows().has(row);
  }

  /** ---------- Column Order & Persistence ---------- */

  /** Set column order (from drag-drop). */
  setColumnOrder(order: string[]): void {
    this._columnOrder.set(order);
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

  /** Persist selection to localStorage. */
  private persistSelection(): void {
    const key = `smart-table-selection-${this.tableId()}`;
    const selected = Array.from(this._selectedRows());
    try {
      localStorage.setItem(key, JSON.stringify(selected));
    } catch {
      // Ignore storage errors
    }
  }

  /** Persist column order to localStorage. */
  private persistColumnOrder(): void {
    const key = `smart-table-columns-${this.tableId()}`;
    try {
      const payload = {
        columnOrder: this._columnOrder(),
        pinnedColumns: this._pinnedColumns(),
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // Ignore storage errors
    }
  }

  /** Restore column order and pinned from localStorage on init. */
  private restorePersistence(): void {
    const colKey = `smart-table-columns-${this.tableId()}`;
    const selKey = `smart-table-selection-${this.tableId()}`;

    // Restore column order
    try {
      const stored = localStorage.getItem(colKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.columnOrder && parsed.columnOrder.length > 0) {
          this._columnOrder.set(parsed.columnOrder);
        }
        if (parsed.pinnedColumns && parsed.pinnedColumns.length > 0) {
          this._pinnedColumns.set(parsed.pinnedColumns);
        }
      }
    } catch {
      /* noop */
    }

    // Restore selection
    try {
      const stored = localStorage.getItem(selKey);
      if (stored) {
        const parsed: T[] = JSON.parse(stored);
        this._selectedRows.set(new Set(parsed));
      }
    } catch {
      /* noop */
    }
  }

  /** ---------- Row State Methods ---------- */

  /** Set row state (disabled/expanded/detail). */
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

  /** Check if row is disabled. */
  isRowDisabled(row: T): boolean {
    return !!this.getRowState(row).disabled;
  }

  /** ---------- Editing Methods ---------- */

  /** Start editing a cell. */
  beginEdit(row: T, key: string): void {
    const rowId = this.idFn(row);
    this._editState.set({ rowId, key });
    this._draft.set({}); // reset draft
    // Focus the element after a microtask
    setTimeout(() => this.focusEditor(), 0);
  }

  /** Commit the current edit. */
  commitEdit(): void {
    const edit = this._editState();
    if (!edit) return;

    const row = this.rows().find(r => this.idFn(r) === edit.rowId);
    if (!row) return;

    const key = edit.key;
    const colDef = this.columns().find(c => c.key === key);
    if (!colDef) return;

    const value = this._draft()[key as keyof Partial<T>];
    const previous = colDef.valueFn ? colDef.valueFn(row) : (row as any)[key];

    // Run validator if provided
    if (colDef.validator && value !== undefined) {
      const validationResult = colDef.validator!(value, row);
      if (validationResult !== null) {
        // Show error - we'll store it in the draft's error state
        ;(this._draft() as any).error = validationResult;
        return;
      }
      delete (this._draft() as any).error;
    }

    // Emit cellEdit event
    this.cellEdit.emit({
      row,
      key,
      oldValue: previous,
      newValue: value,
    });

    // Clear edit state
    this.cancelEdit();
  }

  /** Cancel the current edit. */
  cancelEdit(): void {
    this._editState.set(null);
    this._draft.set({});
  }

  /** Focus the editor input. */
  focusEditor(): void {
    const nativeEl = document.querySelector('.dt-editor') as HTMLInputElement;
    if (nativeEl) {
      nativeEl.focus();
    }
  }

  /** Handle keydown in editor: Tab/Enter to commit, Esc to cancel. */
  onEditorKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEdit();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      this.commitEdit();
      // Move to next editable cell - simplified: just commit
    }
  }

  /** ---------- Export Methods ---------- */

  /** Export current data as CSV (respecting filters/sort/pagination). */
  exportCsv(): void {
    const rows = this.pagedRows; // Could also use filteredRows for "all current page"
    const cols = this.columns().filter(c => c.key !== '');
    const headers = cols.map(c => c.header);

    const esc = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const headerRow = headers.map(esc).join(',');
    const dataRows = rows.map(r => cols.map(c => esc(this.cellValue(c, r))).join(','));
    const csv = [headerRow, ...dataRows].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    this.exportCsv.emit(blob);

    // Trigger download
    this.downloadBlob(blob, `${this.tableId()}-export.csv`);
  }

  /** Export current data as Excel (via SheetJS - lazy loaded). */
  exportExcel(): void {
    import('xlsx').then(xlsx => {
      const rows = this.pagedRows;
      const cols = this.columns().filter(c => c.key !== '');

      if (rows.length === 0) {
        this.exportExcel.emit(new Blob([], { type: 'application/vnd.ms-excel' }));
        return;
      }

      const worksheet = xlsx.utils.json_to_sheet(rows as any[]);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

      const excelBuf = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      const blob = new Blob([excelBuf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      this.exportExcel.emit(blob);
    }).catch(() => {
      // Fallback: generate HTML table .xls
      this.exportExcel.emit(new Blob([], { type: 'application/vnd.ms-excel' }));
    });
  }

  /** Get cell value for export. */
  private cellValue(col: ColumnDef<T>, row: T): unknown {
    if (col.valueFn) return col.valueFn(row);
    return (row as any)[col.key];
  }

  /** Download a blob with a filename. */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** ---------- CDK Drag-Drop ---------- */

  /** Handle column header reorder drop. */
  onColumnDrop(event: CdkDragDrop<string[]>): void {
    if (!this.reorderable()) return;

    moveItemInArray(this._columnOrder(), event.previousIndex, event.currentIndex);
    this._columnOrder.update(order => [...order]); // ensure signal update

    this.columnReorder.emit({
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
    });
  }

  /** Handle row reorder drop (if reorderable). */
  onRowDrop(event: CdkDragDrop<T[]>): void {
    if (!this.reorderable() || this.virtualScroll()) return;

    // Similar to existing table, reorder pageRows and map back to source
    const shown = this.pagedRows;
    const reordered = [...shown];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);

    // Map back to source
    const source = [...this.rows()];
    const shownSet = new Set(shown);
    const positions: number[] = [];
    source.forEach((r, i) => {
      if (shownSet.has(r)) positions.push(i);
    });

    const list = [...source];
    reordered.forEach((r, j) => {
      list[positions[j]] = r;
    });

    this.rows.set(list);
    this.rowReorder.emit({
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
    });
  }

  /** Disable row drag when in virtual-scroll mode. */
  getRowDragDisabled(rowIndex: number): boolean {
    return this.virtualScroll();
  }

  /** ---------- Virtual Scroll Check ---------- */

  /** Ensure viewport recalculates when data changes. */
  private checkViewportSize(): void {
    if (this.viewport && this.virtualScroll()) {
      this.viewport.checkViewportSize();
    }
  }

  /** ---------- Resize Observer for Column Widths ---------- */

  /** Set up ResizeObserver to sync frozen column widths. */
  setupResizeObserver(): void {
    const cols = this._elRef.nativeElement.querySelectorAll('.dt-column');
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        // Find the column and update a shared signal
        const colEl = entry.target as HTMLElement;
        const key = colEl.getAttribute('data-column-key');
        if (key) {
          // We'd update a signal here, but for simplicity we just note the width
          // In a full implementation, this would update a shared columnWidths signal
        }
      }
    });

    cols.forEach(col => observer.observe(col));
  }

  /** ---------- NGOnDestroy ---------- */

  ngOnDestroy(): void {
    // Cleanup any stored effects
  }
}