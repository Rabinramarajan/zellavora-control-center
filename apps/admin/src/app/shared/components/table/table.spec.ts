import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Table, ColumnDef } from './table';

interface Row {
  id: number;
  name: string;
  active: boolean;
}

const COLUMNS: ColumnDef<Row>[] = [
  { key: 'id', header: 'ID', sortable: true },
  { key: 'name', header: 'Name', sortable: true },
  { key: 'active', header: 'Active' },
];

describe('Table', () => {
  let component: Table<Row>;
  let fixture: ComponentFixture<Table<Row>>;
  let c: any;

  const rows: Row[] = [
    { id: 3, name: 'Charlie', active: true },
    { id: 1, name: 'Alpha', active: false },
    { id: 2, name: 'Bravo', active: true },
  ];

  const setInput = (key: string, value: unknown) =>
    fixture.componentRef.setInput(key, value);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Table<Row>],
    }).compileComponents();

    fixture = TestBed.createComponent<Table<Row>>(Table<Row>);
    component = fixture.componentInstance;
    c = component as any;
    setInput('columns', COLUMNS);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should search across all columns', () => {
    setInput('rows', rows);
    component.pageSize.set(100);
    fixture.detectChanges();

    component.search.set('bravo');
    fixture.detectChanges();

    expect(c.sorted().length).toBe(1);
    expect(c.sorted()[0].name).toBe('Bravo');
  });

  it('should sort ascending then descending then clear', () => {
    setInput('rows', rows);
    component.pageSize.set(100);
    fixture.detectChanges();

    c.toggleSort('id');
    expect(c.sorted().map((r: Row) => r.id)).toEqual([1, 2, 3]);

    c.toggleSort('id');
    expect(c.sorted().map((r: Row) => r.id)).toEqual([3, 2, 1]);

    c.toggleSort('id');
    expect(component.sort().key).toBeNull();
    expect(c.sorted().map((r: Row) => r.id)).toEqual([3, 1, 2]);
  });

  it('should paginate rows', () => {
    setInput('rows', rows);
    component.pageSize.set(2);
    fixture.detectChanges();

    expect(c.total()).toBe(3);
    expect(c.totalPages()).toBe(2);
    expect(c.pageRows().length).toBe(2);

    component.page.set(2);
    fixture.detectChanges();

    expect(c.pageRows().length).toBe(1);
    expect(c.rangeStart()).toBe(3);
    expect(c.rangeEnd()).toBe(3);
  });

  it('should clamp the page to the last valid page', () => {
    setInput('rows', rows);
    component.pageSize.set(2);
    fixture.detectChanges();
    expect(c.totalPages()).toBe(2);

    component.page.set(99);
    fixture.detectChanges();

    expect(c.safePage()).toBe(2);
    expect(c.pageRows().length).toBe(1);
  });

  it('should build the numbered pagination list with ellipsis gaps', () => {
    const many: Row[] = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: 'Row ' + (i + 1), active: true }));
    setInput('rows', many);
    component.pageSize.set(2);
    fixture.detectChanges();
    expect(c.totalPages()).toBe(25);

    component.page.set(1);
    fixture.detectChanges();
    expect(c.pages()).toEqual([1, 2, null, 25]);

    component.page.set(13);
    fixture.detectChanges();
    expect(c.pages()).toEqual([1, null, 12, 13, 14, null, 25]);

    component.page.set(25);
    fixture.detectChanges();
    expect(c.pages()).toEqual([1, null, 24, 25]);
  });

  it('should apply search and sort before pagination', () => {
    setInput('rows', rows);
    component.pageSize.set(1);
    component.sort.set({ key: 'name', dir: 'asc' });
    fixture.detectChanges();

    expect(c.sorted().map((r: Row) => r.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(c.pageRows().length).toBe(1);
  });

  it('should select and deselect rows', () => {
    setInput('rows', rows);
    setInput('selectable', true);
    fixture.detectChanges();

    const row = rows[0];
    c.toggleRow(row);
    expect(component.selection().length).toBe(1);
    expect(c.isSelected(row)).toBe(true);

    c.toggleRow(row);
    expect(component.selection().length).toBe(0);
  });

  it('should toggle column visibility', () => {
    setInput('rows', rows);
    setInput('columnToggle', true);
    fixture.detectChanges();

    c.toggleColumn('name');
    expect(component.visibleColumns().some((col) => col.key === 'name')).toBe(false);

    c.toggleColumn('name');
    expect(component.visibleColumns().some((col) => col.key === 'name')).toBe(true);
  });

  it('should emit cellEdit on commit', () => {
    setInput('rows', rows);
    setInput('editable', true);
    fixture.detectChanges();

    const spy = jasmine.createSpy();
    const sub = component.cellEdit.subscribe(spy);

    c.beginEdit(rows[0], COLUMNS[1]);
    c.commitEdit(rows[0], COLUMNS[1], 'NewName');

    expect(spy).toHaveBeenCalledWith({ row: rows[0], key: 'name', value: 'NewName', previous: 'Charlie' });
    sub.unsubscribe();
  });
});
