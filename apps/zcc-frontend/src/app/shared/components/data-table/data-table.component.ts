import { NgTemplateOutlet } from '@angular/common';
import { FormInputControl } from '@zellavoras/ui';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  contentChild,
  contentChildren,
  input,
  linkedSignal,
  model,
  output,
} from '@angular/core';
import { CsvExporter } from '../../utils/csv-exporter';
import { PageChangeEvent, PaginationComponent } from '../pagination/pagination.component';
import {
  DataTableActionsDirective,
  DataTableCellContext,
  DataTableCellDirective,
  DataTableEmptyDirective,
  DataTableFooterDirective,
} from './data-table.directives';
import { DataTableColumn, DataTableFilters, DataTableSort, RowClassFn } from './data-table.types';

/**
 * The app's one table. In `server` mode the parent owns loading, sorting and
 * paging and the table only renders `rows`. In `client` mode the table filters,
 * searches, sorts and pages the full `rows` array itself.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [NgTemplateOutlet, FormInputControl, PaginationComponent],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent<T> {
  readonly rows = input<readonly T[]>([]);
  readonly columns = input.required<readonly DataTableColumn<T>[]>();
  readonly trackBy = input<(row: T) => unknown>((row) => (row as { id?: unknown }).id);
  readonly rowLabel = input<(row: T) => string>(() => 'row');
  readonly rowClass = input<RowClassFn<T> | null>(null);
  readonly rowClickable = input(false);

  readonly mode = input<'server' | 'client'>('server');
  /** Client-mode search term; bind it from a page field or use the built-in box. */
  readonly search = model('');
  readonly searchable = input(false);
  readonly searchPlaceholder = input('Search…');
  readonly filters = model<DataTableFilters>({});

  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly errorTitle = input('Failed to load data');
  readonly caption = input('');
  readonly emptyTitle = input('Nothing to show');
  readonly emptyText = input('');
  readonly skeletonRows = input(6);
  readonly minWidth = input<string | null>(null);
  /** Drops the panel chrome when the table sits inside another card. */
  readonly bare = input(false);

  readonly selectable = input(false);
  readonly paginated = input(true);
  readonly total = input(0);
  readonly page = input(1);
  readonly pageSize = model(10);
  readonly pageSizeOptions = input<readonly number[]>([10, 25, 50, 100]);
  readonly entityLabel = input('items');

  readonly sort = model<DataTableSort | null>(null);
  readonly selected = model<ReadonlySet<string>>(new Set());

  readonly paginate = output<PageChangeEvent>();
  readonly retry = output<void>();
  readonly scrolled = output<void>();
  readonly rowClick = output<T>();

  private readonly cellTemplates = contentChildren(DataTableCellDirective);
  protected readonly actionsTemplate = contentChild(DataTableActionsDirective);
  protected readonly emptyTemplate = contentChild(DataTableEmptyDirective);
  protected readonly footerTemplate = contentChild(DataTableFooterDirective);

  protected readonly templates = computed(
    () =>
      new Map<string, TemplateRef<DataTableCellContext<T>>>(
        this.cellTemplates().map((c) => [
          c.dtCell(),
          c.template as unknown as TemplateRef<DataTableCellContext<T>>,
        ])
      )
  );

  private readonly isClient = computed(() => this.mode() === 'client');

  /** Client-mode paging; returns to the input page whenever the result set changes. */
  private readonly clientPage = linkedSignal({
    source: () => [this.rows(), this.search(), this.filters(), this.sort(), this.page()] as const,
    computation: ([, , , , page]) => page,
  });

  protected readonly visibleColumns = computed(() => this.columns().filter((c) => !c.hidden));

  /** Filtered and sorted rows across every page (client mode); what CSV export uses. */
  readonly processedRows = computed<readonly T[]>(() => {
    if (!this.isClient()) return this.rows();
    const columns = this.columns();
    const active = Object.entries(this.filters())
      .filter(([, value]) => value !== '')
      .map(([id, value]) => ({ column: columns.find((c) => c.id === id), value }))
      .filter((f): f is { column: DataTableColumn<T>; value: string } => !!f.column);
    const term = this.search().trim().toLowerCase();

    let rows = this.rows();
    if (active.length || term) {
      rows = rows.filter(
        (row) =>
          active.every(({ column, value }) => String(this.valueOf(column, row) ?? '') === value) &&
          (!term || columns.some((c) => this.searchTextOf(c, row).includes(term)))
      );
    }

    const sort = this.sort();
    const column = sort && columns.find((c) => c.sortKey === sort.key);
    if (!sort || !column) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort(
      (a, b) => compareValues(this.valueOf(column, a), this.valueOf(column, b)) * factor
    );
  });

  protected readonly viewRows = computed<readonly T[]>(() => {
    const rows = this.processedRows();
    if (!this.isClient() || !this.paginated()) return rows;
    const size = this.pageSize();
    const start = (this.clientPage() - 1) * size;
    return rows.slice(start, start + size);
  });

  protected readonly viewTotal = computed(() =>
    this.isClient() ? this.processedRows().length : this.total()
  );
  protected readonly viewPage = computed(() => (this.isClient() ? this.clientPage() : this.page()));
  protected readonly viewPageSize = computed(() =>
    this.isClient() ? this.pageSize() : this.pageSize()
  );

  protected readonly hasRows = computed(() => this.viewRows().length > 0);
  protected readonly skeletons = computed(() => Array.from({ length: this.skeletonRows() }));
  protected readonly colspan = computed(
    () =>
      this.visibleColumns().length + (this.selectable() ? 1 : 0) + (this.actionsTemplate() ? 1 : 0)
  );

  private readonly pageIds = computed(() => this.viewRows().map((row) => this.rowId(row)));

  protected readonly allSelected = computed(() => {
    const sel = this.selected();
    const ids = this.pageIds();
    return ids.length > 0 && ids.every((id) => sel.has(id));
  });

  protected readonly someSelected = computed(
    () => !this.allSelected() && this.pageIds().some((id) => this.selected().has(id))
  );

  /** Downloads the filtered + sorted rows (every page) as CSV. */
  exportCsv(filename: string): void {
    const columns = this.columns().filter((c) => c.exportable !== false);
    CsvExporter.export(
      filename.replace(/\.csv$/, ''),
      columns.map((c) => c.label),
      this.processedRows().map((row) => columns.map((c) => this.displayOf(c, row)))
    );
  }

  clearSelection(): void {
    this.selected.set(new Set());
  }

  protected onPaginate(event: PageChangeEvent): void {
    if (this.isClient()) {
      const sizeChanged = event.pageSize !== this.pageSize();
      this.pageSize.set(event.pageSize);
      this.clientPage.set(sizeChanged ? 1 : event.page);
    }
    this.paginate.emit(event);
  }

  protected sortBy(key: string): void {
    const current = this.sort();
    this.sort.set(
      current?.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  }

  protected ariaSort(key: string | undefined): 'ascending' | 'descending' | null {
    const current = this.sort();
    if (!key || current?.key !== key) return null;
    return current.dir === 'asc' ? 'ascending' : 'descending';
  }

  protected isSortedDesc(key: string): boolean {
    const current = this.sort();
    return current?.key === key && current.dir === 'desc';
  }

  protected isSelected(row: T): boolean {
    return this.selected().has(this.rowId(row));
  }

  protected toggleRow(row: T): void {
    const id = this.rowId(row);
    this.selected.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected togglePage(): void {
    const clear = this.allSelected();
    this.selected.update((s) => {
      const next = new Set(s);
      this.pageIds().forEach((id) => (clear ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  protected onRowClick(row: T, event: MouseEvent): void {
    if (!this.rowClickable()) return;
    if ((event.target as HTMLElement).closest('a, button, input, select, label')) return;
    this.rowClick.emit(row);
  }

  protected rowClasses(row: T): Record<string, boolean> {
    return {
      'is-selected': this.isSelected(row),
      'is-clickable': this.rowClickable(),
      ...(this.rowClass()?.(row) ?? {}),
    };
  }

  protected cellText(column: DataTableColumn<T>, row: T): string {
    const text = this.displayOf(column, row);
    return text === '' ? '—' : text;
  }

  protected rowId(row: T): string {
    return String(this.trackBy()(row));
  }

  protected cellValue(column: DataTableColumn<T>, row: T): unknown {
    return this.valueOf(column, row);
  }

  private valueOf(column: DataTableColumn<T>, row: T): unknown {
    return column.value ? column.value(row) : (row as Record<string, unknown>)[column.id];
  }

  private displayOf(column: DataTableColumn<T>, row: T): string {
    const value = this.valueOf(column, row);
    if (column.format) return column.format(value, row);
    return value === null || value === undefined ? '' : String(value);
  }

  private searchTextOf(column: DataTableColumn<T>, row: T): string {
    return (column.searchText?.(row) ?? this.displayOf(column, row)).toLowerCase();
  }
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined || a === '') return 1;
  if (b === null || b === undefined || b === '') return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}
