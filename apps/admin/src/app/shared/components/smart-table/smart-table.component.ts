import { FormInputControl } from '@zellavoras/ui';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  contentChild,
  contentChildren,
  effect,
  input,
  model,
  output,
} from '@angular/core';
import { SmartCellContext, SmartCellDirective, SmartEmptyDirective } from './cells/cell.directive';
import { SmartTableStore } from './smart-table.store';
import { ColumnDef, FilterState, SelectionMode, SortState, TrackByFn } from './smart-table.types';

@Component({
  selector: 'app-smart-table',
  standalone: true,
  imports: [NgTemplateOutlet, FormInputControl],
  templateUrl: './smart-table.component.html',
  styleUrl: './smart-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmartTableComponent<T> {
  readonly rows = input<readonly T[]>([]);
  readonly columns = input.required<readonly ColumnDef<T>[]>();
  readonly trackBy = input<TrackByFn<T>>((row: T) => (row as { id?: unknown }).id ?? row);
  readonly caption = input('');
  readonly loading = input(false);
  readonly skeletonRows = input(5);
  readonly emptyMessage = input('No data to display');

  readonly searchable = input(true);
  readonly searchPlaceholder = input('Search…');
  readonly selectionMode = input<SelectionMode>('none');
  readonly paginated = input(true);
  readonly pageSizeOptions = input<readonly number[]>([10, 25, 50]);
  readonly entityLabel = input('entries');

  readonly search = model('');
  readonly filters = model<FilterState>({});
  readonly sort = model<SortState>({ key: null, direction: 'asc' });
  readonly pageSize = model(10);

  readonly selectionChange = output<readonly T[]>();

  private readonly cellTemplates = contentChildren(SmartCellDirective);
  protected readonly emptyTemplate = contentChild(SmartEmptyDirective);

  readonly store = new SmartTableStore<T>({
    rows: this.rows,
    columns: this.columns,
    trackBy: this.trackBy,
    selectionMode: this.selectionMode,
    search: this.search,
    filters: this.filters,
    sort: this.sort,
    pageSize: this.pageSize,
  });

  protected readonly selectable = computed(() => this.selectionMode() !== 'none');

  protected readonly columnSpan = computed(
    () => this.store.visibleColumns().length + (this.selectable() ? 1 : 0)
  );

  protected readonly skeleton = computed(() =>
    Array.from({ length: this.skeletonRows() }, (_, i) => i)
  );

  protected readonly showSkeleton = computed(() => this.loading() && this.rows().length === 0);

  private readonly templatesByKey = computed(
    () =>
      new Map(
        this.cellTemplates().map((cell) => [
          cell.smartCell(),
          cell.template as TemplateRef<SmartCellContext<T>>,
        ])
      )
  );

  constructor() {
    effect(() => this.selectionChange.emit(this.store.selectedRows()));
  }

  /** Download the filtered + sorted rows as CSV. */
  exportCsv(filename: string): void {
    const blob = new Blob(['﻿' + this.store.toCsv()], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  clearSelection(): void {
    this.store.clearSelection();
  }

  protected cellTemplate(column: ColumnDef<T>): TemplateRef<SmartCellContext<T>> | null {
    return this.templatesByKey().get(column.key) ?? null;
  }

  protected cellContext(column: ColumnDef<T>, row: T, index: number): SmartCellContext<T> {
    return { $implicit: row, value: this.store.valueOf(column, row), index };
  }

  protected ariaSort(column: ColumnDef<T>): 'ascending' | 'descending' | 'none' {
    const { key, direction } = this.sort();
    if (key !== column.key) return 'none';
    return direction === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIcon(column: ColumnDef<T>): string {
    const { key, direction } = this.sort();
    if (key !== column.key) return '↕';
    return direction === 'asc' ? '↑' : '↓';
  }

  protected rowKey(row: T): unknown {
    return this.trackBy()(row);
  }

  protected onPageSize(event: Event): void {
    this.pageSize.set(Number((event.target as HTMLSelectElement).value));
  }
}
