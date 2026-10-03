export type SortDir = 'asc' | 'desc';

export interface DataTableSort<K extends string = string> {
  key: K;
  dir: SortDir;
}

export interface DataTableColumn<T> {
  /** Unique id; also the key a `dtCell` template binds to and a filter targets. */
  id: string;
  label: string;
  /** Makes the header sortable; emitted as `sort.key`. */
  sortKey?: string;
  /** Raw value for display, sorting, filtering and export. Defaults to `row[id]`. */
  value?: (row: T) => unknown;
  /** Display text when no `dtCell` template is projected. */
  format?: (value: unknown, row: T) => string;
  /** Text matched by client-side search. Defaults to the formatted value. */
  searchText?: (row: T) => string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  cellClass?: string;
  headerClass?: string;
  /** Hides the column below the given breakpoint (details live elsewhere on small screens). */
  hideBelow?: 'md' | 'lg' | 'xl';
  /** Never rendered, but still searchable, filterable and exported. */
  hidden?: boolean;
  /** Set false to leave the column out of CSV export. */
  exportable?: boolean;
}

/** Exact-match filters keyed by column id; an empty string means "no filter". */
export type DataTableFilters = Readonly<Record<string, string>>;

export type RowClassFn<T> = (row: T) => Record<string, boolean>;
