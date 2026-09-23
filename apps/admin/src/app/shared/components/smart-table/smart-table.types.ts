import { input, output, signal, computed, EffectRef } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

/** Row state for per-row disabled/expanded/collapsed status. */
export interface RowState {
  disabled?: boolean;
  expanded?: boolean;
  detail?: unknown;
}

/** Column definition for SmartTable. */
export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  pinned?: 'left' | 'right';
  cellTemplate?: TemplateRef<any>;
  valueFn?: (row: T) => unknown;
  formatter?: (value: unknown, row: T) => string;
  validator?: (value: unknown, row: T) => string | null;
}

/** Selection state for multi-row selection. */
export type SelectionMode = 'single' | 'multiple' | 'none';

/** Emitted when selection changes. */
export interface SelectionChange<T> {
  added: T[];
  removed: T[];
  selected: T[];
}

/** Emitted when column order changes. */
export interface ColumnReorder<T> {
  previousIndex: number;
  currentIndex: number;
}

/** Emitted when a cell edit is committed. */
export interface CellEditEvent<T> {
  row: T;
  key: string;
  oldValue: unknown;
  newValue: unknown;
}

/** Emitted when the table is exported. */
export interface ExportEvent<T> {
  filename: string;
  format: 'csv' | 'excel';
  data: T[];
  columns: ColumnDef<T>[];
}

/** Persistence metadata for column order. */
export interface ColumnPersistence {
  columnOrder: string[];
  pinnedColumns: string[];
  visibleColumns: string[];
}

/** Sort state used by the signal chains. */
export interface SortState {
  key: string | null;
  direction: 'asc' | 'desc' | null;
}

/** Filter state mapping column keys to filter values. */
export interface FilterState {
  [key: string]: string | number | Date | null;
}

/** Pagination state. */
export interface PaginationState {
  pageIndex: number;
  pageSize: number;
  pageCount: number;
}

/** Default column definition with all optional fields. */
export const DEFAULT_COLUMN_DEF: ColumnDef<unknown> = {
  key: '',
  header: '',
  sortable: false,
  filterable: false,
  width: '150',
};

/** Row state map stored internally. */
export type RowStateMap<T> = Map<T, RowState>;

/** SmartTable input options. */
export interface SmartTableInputOptions<T> {
  idFn?: (row: T) => string | number;
  selectionMode?: SelectionMode;
  globalFilterableKeys?: string[];
}

/** SmartTable output events. */
export export interface SmartTableOutputs<T> {
  rowClick: output<T>;
  rowDblClick: output<T>;
  selectionChange: output<SelectionChange<T>>;
  cellEdit: output<CellEditEvent<T>>;
  exportCsv: output<Blob>;
  exportExcel: output<Blob>;
  columnReorder: output<ColumnReorder>;
  rowReorder: output<{ previousIndex: number; currentIndex: number }>;
  cellSave: output<CellEditEvent<T>>;
}