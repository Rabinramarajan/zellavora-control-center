import { signal } from '@angular/core';
import { SmartTableStore } from './smart-table.store';
import { ColumnDef, SelectionMode } from './smart-table.types';

interface Row {
  id: number;
  name: string;
  hours: number;
  status: 'draft' | 'approved';
}

const COLUMNS: ColumnDef<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'hours', header: 'Hours', sortable: true, format: (value) => `${value}h` },
  { key: 'status', header: 'Status' },
  { key: 'actions', header: 'Actions', exportable: false },
];

const makeRows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Row ${i + 1}`,
    hours: count - i,
    status: i % 2 ? 'approved' : 'draft',
  }));

const createStore = (rows: Row[], selectionMode: SelectionMode = 'multiple') => {
  const source = signal<readonly Row[]>(rows);
  const store = new SmartTableStore<Row>({
    rows: source,
    columns: signal(COLUMNS),
    selectionMode: signal(selectionMode),
  });
  return { store, source };
};

describe('SmartTableStore', () => {
  it('searches across formatted column values, case-insensitively', () => {
    const { store } = createStore(makeRows(12));
    store.search.set('row 1');
    expect(store.filteredRows().map((r) => r.id)).toEqual([1, 10, 11, 12]);

    store.search.set('3h');
    expect(store.filteredRows().map((r) => r.id)).toEqual([10]);
  });

  it('applies exact-match column filters and ignores empty ones', () => {
    const { store } = createStore(makeRows(4));
    store.setFilter('status', 'approved');
    expect(store.filteredRows().map((r) => r.id)).toEqual([2, 4]);

    store.setFilter('status', '');
    expect(store.total()).toBe(4);
  });

  it('cycles sort asc → desc → off and sorts numbers numerically', () => {
    const { store } = createStore(makeRows(3));
    store.toggleSort('hours');
    expect(store.sortedRows().map((r) => r.hours)).toEqual([1, 2, 3]);

    store.toggleSort('hours');
    expect(store.sortedRows().map((r) => r.hours)).toEqual([3, 2, 1]);

    store.toggleSort('hours');
    expect(store.sort().key).toBeNull();
    expect(store.sortedRows().map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it('pages rows and resets to page 1 when the query changes', () => {
    const { store } = createStore(makeRows(25));
    store.goToPage(3);
    expect(store.currentPage()).toBe(3);
    expect(store.pageRows().length).toBe(5);
    expect(store.rangeStart()).toBe(21);
    expect(store.rangeEnd()).toBe(25);

    store.search.set('row');
    expect(store.currentPage()).toBe(1);
  });

  it('collapses long page lists with gaps', () => {
    const { store } = createStore(makeRows(100));
    store.goToPage(5);
    expect(store.pageItems()).toEqual([1, null, 4, 5, 6, null, 10]);
  });

  it('selects the current page and drops rows that leave the data set', () => {
    const { store, source } = createStore(makeRows(15));
    store.togglePage();
    expect(store.selectedCount()).toBe(10);
    expect(store.allPageSelected()).toBeTrue();

    source.set(source().slice(5));
    expect(store.selectedCount()).toBe(5);
  });

  it('keeps at most one row in single selection mode', () => {
    const rows = makeRows(3);
    const { store } = createStore(rows, 'single');
    store.toggleRow(rows[0]);
    store.toggleRow(rows[1]);
    expect(store.selectedRows()).toEqual([rows[1]]);
  });

  it('exports filtered, sorted rows as escaped CSV without non-exportable columns', () => {
    const { store } = createStore([
      { id: 1, name: 'Plain', hours: 2, status: 'draft' },
      { id: 2, name: 'Has, comma "quoted"', hours: 1, status: 'draft' },
    ]);
    store.toggleSort('hours');
    expect(store.toCsv()).toBe(
      'Name,Hours,Status\r\n"Has, comma ""quoted""",1h,draft\r\nPlain,2h,draft'
    );
  });
});
