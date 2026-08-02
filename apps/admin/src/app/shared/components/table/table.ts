import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, contentChild, contentChildren, Directive, effect, inject, input, linkedSignal, model, output, signal, TemplateRef } from '@angular/core';
import {
  CdkDropList,
  CdkDrag,
  CdkDragHandle,
  CdkDragDrop,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { CdkVirtualScrollViewport, CdkVirtualForOf, CdkFixedSizeVirtualScroll } from '@angular/cdk/scrolling';

/* ================================================================== *
 *  Requires: npm i @angular/cdk
 *  Feature flags (all default OFF except searchable):
 *    reorderable          #1  row drag-and-drop           (excludes virtualScroll)
 *    columnToggle         #2  show/hide columns UI
 *    headerGroups input   #3  multi-level rowspan/colspan headers
 *    (export API)         #4  CSV / Excel with custom fields+headers
 *    loading + skeleton   #5  skeleton placeholder rows
 *    <ng-template appEmpty> #6 custom empty state
 *    virtualScroll        #7/#8 CDK virtual scroll (fixed itemSize)  (excludes reorderable)
 *    editable             #9  in-place cell editing + per-column menu (editor core)
 *    selectable           #10 checkbox selection + header select-all
 *    freezeFirstRow /
 *      freezeLastRow /
 *      frozenColumns      #11 frozen rows & columns
 * ================================================================== */

export type SortDir = 'asc' | 'desc';

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  editable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  value?: (row: T) => unknown;
  format?: (value: unknown, row: T) => string;
}

/** #3 A cell in a header row above the leaf columns. */
export interface HeaderCell {
  label: string;
  colspan?: number;
  rowspan?: number;
  align?: 'left' | 'center' | 'right';
}

export interface SortState { key: string | null; dir: SortDir; }
export interface TableQuery { search: string; sort: SortState; page: number; pageSize: number; }
export interface CellEdit<T> { row: T; key: string; value: unknown; previous: unknown; }

/** #4 Export options. */
export interface ExportOptions {
  filename?: string;
  fields?: string[];
  headers?: Record<string, string>;
  selectedOnly?: boolean;
}

/* ------- projected templates ------- */

@Directive({ selector: '[appCell]', standalone: true })
export class CellDirective {
  readonly appCell = input.required<string>();
  readonly template = inject(TemplateRef);
}

@Directive({ selector: '[appEmpty]', standalone: true })
export class EmptyDirective {
  readonly template = inject(TemplateRef);
}

@Component({
  selector: 'app-table',
  imports: [
    NgTemplateOutlet,
    CdkDropList, CdkDrag, CdkDragHandle,
    CdkVirtualScrollViewport, CdkVirtualForOf, CdkFixedSizeVirtualScroll,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dt-host' },
  templateUrl: './table.html',
  styleUrl: './table.css',
})
export class Table<T extends object>  {
  /* ---- inputs ---- */
  readonly rows = input<readonly T[]>([]);
  readonly columns = input.required<ColumnDef<T>[]>();
  readonly headerGroups = input<HeaderCell[][]>([]);        // #3
  readonly loading = input(false);
  readonly searchable = input(true);
  readonly searchPlaceholder = input('Search\u2026');
  readonly emptyMessage = input('No data to display');
  readonly pageSizeOptions = input<number[]>([10, 25, 50, 100]);
  readonly trackBy = input<(row: T) => unknown>();
  readonly skeletonRows = input(8);                          // #5

  /* feature flags */
  readonly reorderable = input(false);                      // #1
  readonly columnToggle = input(false);                     // #2
  readonly selectable = input(false);                       // #10
  readonly editable = input(false);                         // #9 core
  readonly freezeFirstRow = input(false);                   // #11
  readonly freezeLastRow = input(false);                    // #11
  readonly frozenColumns = input<string[]>([]);             // #11
  readonly virtualScroll = input(false);                    // #7/#8
  readonly virtualScrollItemSize = input(44);
  readonly virtualHeight = input('420px');

  readonly serverSide = input(false);
  readonly totalCount = input<number>();

  /* ---- two-way models ---- */
  readonly search = model('');
  readonly page = model(1);
  readonly pageSize = model(10);
  readonly sort = model<SortState>({ key: null, dir: 'asc' });
  readonly selection = model<T[]>([]);                       // #10
  readonly data = model<readonly T[] | null>(null);         // #1 writable copy for reorder

  /* ---- outputs ---- */
  readonly rowClick = output<T>();
  readonly queryChange = output<TableQuery>();
  readonly cellEdit = output<CellEdit<T>>();                // #9
  readonly reorder = output<T[]>();                         // #1

  /* ---- projected ---- */
  protected readonly cells = contentChildren(CellDirective);
  protected readonly emptyTpl = contentChild(EmptyDirective);
  protected cellTemplate = (k: string) => this.cells().find(c => c.appCell() === k)?.template ?? null;

  /* ---- column visibility (#2) ---- */
  protected readonly hidden = signal(new Set<string>());
  protected readonly allColumns = computed(() => this.columns());
  readonly visibleColumns = computed(() => this.columns().filter(c => !this.hidden().has(c.key)));
  protected colPanelOpen = signal(false);
  protected toggleColPanel = () => this.colPanelOpen.update(v => !v);
  protected toggleColumn(key: string) {
    this.hidden.update(s => {
      const n = new Set(s);
      if (n.has(key)) { n.delete(key); } else { n.add(key); }
      return n;
    });
  }

  constructor() {
    effect(() => { this.search(); this.sort(); this.pageSize(); this.page.set(1); });
    effect(() => {
      if (!this.serverSide()) return;
      this.queryChange.emit({ search: this.search(), sort: this.sort(), page: this.page(), pageSize: this.pageSize() });
    });
    effect(() => {
      if (this.reorderable() && this.virtualScroll())
        console.warn('[data-table] reorderable and virtualScroll are mutually exclusive; disable one.');
    });
  }

  protected readonly source = computed<readonly T[]>(() => this.data() ?? this.rows());

  /* ---- client pipeline ---- */
  protected readonly filtered = computed<readonly T[]>(() => {
    if (this.serverSide()) return this.source();
    const q = this.search().trim().toLowerCase();
    if (!q) return this.source();
    const cols = this.columns();
    return this.source().filter(r => cols.some(c => String(this.rawValue(c, r) ?? '').toLowerCase().includes(q)));
  });
  protected readonly sorted = computed<readonly T[]>(() => {
    if (this.serverSide()) return this.filtered();
    const { key, dir } = this.sort();
    if (!key) return this.filtered();
    const col = this.columns().find(c => c.key === key);
    if (!col) return this.filtered();
    const f = dir === 'asc' ? 1 : -1;
    return [...this.filtered()].sort((a, b) => {
      const av = this.rawValue(col, a), bv = this.rawValue(col, b);
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * f;
      return String(av).localeCompare(String(bv)) * f;
    });
  });
  protected readonly total = computed(() => this.serverSide() ? (this.totalCount() ?? this.source().length) : this.sorted().length);
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly safePage = linkedSignal(() => Math.min(this.page(), this.totalPages()));
  protected readonly pageRows = computed<readonly T[]>(() => {
    if (this.serverSide()) return this.source();
    if (this.virtualScroll()) return this.sorted();
    const start = (this.safePage() - 1) * this.pageSize();
    return this.sorted().slice(start, start + this.pageSize());
  });
  protected readonly rangeStart = computed(() => this.total() === 0 ? 0 : (this.safePage() - 1) * this.pageSize() + 1);
  protected readonly rangeEnd = computed(() => Math.min(this.safePage() * this.pageSize(), this.total()));

  /* ---- header helpers (#3) ---- */
  protected headerRowCount = computed(() => this.headerGroups().length + 1);
  protected leafColspan = computed(() =>
    this.visibleColumns().length + (this.selectable() ? 1 : 0) + (this.reorderable() ? 1 : 0));

  /* ---- values ---- */
  protected rawValue = (c: ColumnDef<T>, r: T) => c.value ? c.value(r) : (r as Record<string, unknown>)[c.key];
  protected display = (c: ColumnDef<T>, r: T) => { const v = this.rawValue(c, r); return c.format ? c.format(v, r) : String(v ?? ''); };
  protected trackRow = (i: number, r: T) => this.trackBy() ? this.trackBy()!(r) : i;
  protected skeletonArray = computed(() => Array.from({ length: this.skeletonRows() }, (_, i) => i));

  /* ---- sort ---- */
  protected toggleSort(key: string) {
    const s = this.sort();
    if (s.key !== key) this.sort.set({ key, dir: 'asc' });
    else if (s.dir === 'asc') this.sort.set({ key, dir: 'desc' });
    else this.sort.set({ key: null, dir: 'asc' });
  }
  protected sortIndicator = (c: ColumnDef<T>) => this.sort().key === c.key ? this.sort().dir : null;
  protected ariaSort = (c: ColumnDef<T>) => { const d = this.sortIndicator(c); return d === 'asc' ? 'ascending' : d === 'desc' ? 'descending' : 'none'; };
  protected goto = (p: number) => this.page.set(Math.min(Math.max(1, p), this.totalPages()));

  /* ---- selection (#10) ---- */
  protected isSelected = (r: T) => this.selection().includes(r);
  protected selectedCount = computed(() => this.selection().length);
  protected allSelected = computed(() => this.pageRows().length > 0 && this.pageRows().every(r => this.isSelected(r)));
  protected someSelected = computed(() => this.selectedCount() > 0 && !this.allSelected());
  protected toggleRow(r: T) {
    this.selection.update(s => s.includes(r) ? s.filter(x => x !== r) : [...s, r]);
  }
  protected toggleAll() {
    this.allSelected() ? this.selection.set([]) : this.selection.set([...this.pageRows()]);
  }

  /* ---- reorder (#1) ---- */
  protected onDrop(e: CdkDragDrop<unknown>) {
    if (!this.reorderable()) return;

    // cdk indices are relative to the currently displayed rows (pageRows),
    // which may be filtered/sorted/paginated. Reorder that slice, then map
    // the new order back onto the full source by row identity.
    const shown = this.pageRows();
    const reordered = [...shown];
    moveItemInArray(reordered, e.previousIndex, e.currentIndex);

    const positions: number[] = [];
    const shownSet = new Set<T>(shown);
    this.source().forEach((r, i) => { if (shownSet.has(r)) positions.push(i); });

    const list = [...this.source()];
    reordered.forEach((r, j) => { list[positions[j]] = r; });
    this.data.set(list);
    this.reorder.emit(list);
  }

  /* ---- in-place editing (#9) ---- */
  protected editingKey = signal<string | null>(null);
  protected editingRow = signal<T | null>(null);
  protected isEditing = (r: T, c: ColumnDef<T>) => this.editingRow() === r && this.editingKey() === c.key;
  protected beginEdit(r: T, c: ColumnDef<T>) { this.editingRow.set(r); this.editingKey.set(c.key); }
  protected cancelEdit() { this.editingRow.set(null); this.editingKey.set(null); }
  protected commitEdit(r: T, c: ColumnDef<T>, raw: string) {
    const previous = this.rawValue(c, r);
    const value: unknown = typeof previous === 'number' ? Number(raw) : raw;
    if (value !== previous) this.cellEdit.emit({ row: r, key: c.key, value, previous });
    this.cancelEdit();
  }

  /* ---- frozen columns (#11) ---- */
  protected hasFrozen = computed(() => this.frozenColumns().length > 0);
  protected isFrozen = (key: string) => this.frozenColumns().includes(key);
  protected frozenOffset(key: string): number | null {
    if (!this.isFrozen(key)) return null;
    let offset = (this.selectable() ? 44 : 0) + (this.reorderable() ? 36 : 0);
    for (const col of this.visibleColumns()) {
      if (col.key === key) return offset;
      if (this.isFrozen(col.key)) offset += parseInt(col.width ?? '150', 10) || 150;
    }
    return offset;
  }

  /* ---- per-column menu (#9) ---- */
  protected menuKey = signal<string | null>(null);
  protected menuPos = signal({ x: 0, y: 0 });
  protected openMenu(key: string, e: MouseEvent) {
    e.stopPropagation();
    const r = (e.target as HTMLElement).getBoundingClientRect();
    this.menuPos.set({ x: r.left, y: r.bottom });
    this.menuKey.set(key);
  }
  protected closeMenu = () => this.menuKey.set(null);
  protected menuSort(key: string, dir: SortDir) { this.sort.set({ key, dir }); this.closeMenu(); }
  protected async copyColumn(key: string) {
    const col = this.columns().find(c => c.key === key);
    if (!col) return;
    const text = this.sorted().map(r => this.display(col, r)).join('\n');
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
    this.closeMenu();
  }

  /* ================= #4 Export API (call via @ViewChild) ================= */
  exportCsv(opts: ExportOptions = {}) {
    const { rows, cols, headers } = this.buildExport(opts);
    const esc = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csv = [headers.map(esc).join(','), ...rows.map(r => cols.map(c => esc(this.display(c, r))).join(','))].join('\n');
    this.download(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), (opts.filename ?? 'export') + '.csv');
  }
  /** Dependency-free Excel: HTML-table .xls. For true .xlsx, pipe buildExport() through SheetJS. */
  exportExcel(opts: ExportOptions = {}) {
    const { rows, cols, headers } = this.buildExport(opts);
    const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const thead = '<tr>' + headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>';
    const tbody = rows.map(r => '<tr>' + cols.map(c => '<td>' + esc(this.display(c, r)) + '</td>').join('') + '</tr>').join('');
    const html = '<html><head><meta charset="utf-8"></head><body><table border="1">' + thead + tbody + '</table></body></html>';
    this.download(new Blob([html], { type: 'application/vnd.ms-excel' }), (opts.filename ?? 'export') + '.xls');
  }
  protected buildExport(opts: ExportOptions) {
    const keys = opts.fields ?? this.visibleColumns().map(c => c.key);
    const cols = keys.map(k => this.columns().find(c => c.key === k)).filter(Boolean) as ColumnDef<T>[];
    const headers = cols.map(c => opts.headers?.[c.key] ?? c.header);
    const rows = opts.selectedOnly && this.selectable() ? this.selection() : this.sorted();
    return { rows, cols, headers };
  }
  protected download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }
}

