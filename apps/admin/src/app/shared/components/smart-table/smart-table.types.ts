export type SortDirection = 'asc' | 'desc';

export type SelectionMode = 'none' | 'single' | 'multiple';

export type CellAlign = 'left' | 'center' | 'right';

/** Column definition for SmartTable. */
export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: CellAlign;
  /** Any CSS width, e.g. '8rem' or '120px'. */
  width?: string;
  /** Extra classes (e.g. utility classes) applied to every body cell of the column. */
  cellClass?: string;
  /** Hidden columns still take part in search, filters and CSV export. */
  hidden?: boolean;
  /** Set false to leave the column out of CSV export (e.g. an actions column). */
  exportable?: boolean;
  /** Raw value used for sorting, filtering and export. Defaults to `row[key]`. */
  value?: (row: T) => unknown;
  /** Display text when no cell template is projected. Defaults to `String(value)`. */
  format?: (value: unknown, row: T) => string;
  /** Text matched by the global search. Defaults to the formatted value. */
  searchText?: (row: T) => string;
}

export interface SortState {
  key: string | null;
  direction: SortDirection;
}

/** Exact-match column filters keyed by column key; an empty string means "no filter". */
export type FilterState = Readonly<Record<string, string>>;

export type TrackByFn<T> = (row: T) => unknown;
