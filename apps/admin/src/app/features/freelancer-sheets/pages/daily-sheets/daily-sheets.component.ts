import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  ColumnDef,
  FilterState,
  SmartCellDirective,
  SmartEmptyDirective,
  SmartTableComponent,
  SortState,
} from '../../../../shared/components/smart-table';
import { DailySheet, SheetsStore } from '../../sheets.store';
import {
  SheetStatus,
  initialsOf,
  isoDay,
  isoMonth,
  paletteFor,
  statusLabel,
  statusPill,
} from '../../sheets.presentation';

interface EntryRow {
  id: string;
  date: string;
  dateLabel: string;
  project: string;
  projectType: string;
  projectColor: string;
  projectInitials: string;
  task: string;
  description: string;
  start: string;
  end: string;
  breakLabel: string;
  hours: number;
  status: SheetStatus;
  statusLabel: string;
}

interface Slice {
  name: string;
  hours: number;
  percent: number;
  color: string;
  dash: string;
  offset: string;
}

const PAGE_SIZE_OPTIONS = [6, 12, 24, 50];

const STATUS_OPTIONS: { value: SheetStatus; label: string }[] = (
  ['draft', 'submitted', 'approved', 'rejected'] as const
).map((status) => ({ value: status, label: statusLabel(status) }));

const ENTRY_COLUMNS: ColumnDef<EntryRow>[] = [
  {
    key: 'date',
    header: 'Date',
    sortable: true,
    format: (_, row) => row.dateLabel,
    cellClass: 'text-slate-300',
  },
  { key: 'project', header: 'Project', sortable: true },
  {
    key: 'task',
    header: 'Task / Description',
    sortable: true,
    searchText: (row) => `${row.task} ${row.description}`,
  },
  { key: 'start', header: 'Start', cellClass: 'text-slate-300 tabular-nums' },
  { key: 'end', header: 'End', cellClass: 'text-slate-300 tabular-nums' },
  { key: 'breakLabel', header: 'Break', cellClass: 'text-slate-400 tabular-nums' },
  {
    key: 'hours',
    header: 'Total',
    sortable: true,
    format: (value) => `${value}h`,
    cellClass: 'text-white font-semibold tabular-nums',
  },
  { key: 'status', header: 'Status', sortable: true, format: (_, row) => row.statusLabel },
  { key: 'actions', header: 'Actions', align: 'right', exportable: false },
];

/** Circumference of the r=54 donut ring used in Today's Summary. */
const DONUT_CIRCUMFERENCE = 2 * Math.PI * 54;

@Component({
  selector: 'app-daily-sheets',
  standalone: true,
  imports: [CommonModule, SmartTableComponent, SmartCellDirective, SmartEmptyDirective],
  templateUrl: './daily-sheets.component.html',
  styleUrls: ['../../styles/sheets-theme.css', './daily-sheets.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailySheetsComponent implements OnInit {
  private readonly store = inject(SheetsStore);
  private readonly router = inject(Router);

  public readonly isLoading = this.store.isLoading;
  public readonly error = this.store.error;

  public readonly selectedDate = signal(new Date());

  public readonly selectedDateLabel = computed(() =>
    this.selectedDate().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  );

  // ---- entries table ----------------------------------------------------

  public readonly columns = ENTRY_COLUMNS;
  public readonly statusOptions = STATUS_OPTIONS;
  public readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  public readonly filters = signal<FilterState>({ project: '', status: '' });
  public readonly sort = signal<SortState>({ key: 'date', direction: 'desc' });
  public readonly pageSize = signal(PAGE_SIZE_OPTIONS[0]);

  public readonly rows = computed<EntryRow[]>(() =>
    this.store.dailySheets().map((sheet) => this.toRow(sheet))
  );

  public readonly projectOptions = computed(() => {
    const names = new Set(this.rows().map((row) => row.project));
    return [...names].sort((a, b) => a.localeCompare(b));
  });

  // ---- KPIs -------------------------------------------------------------

  private readonly sheetsOn = (date: Date): DailySheet[] => {
    const day = isoDay(date);
    return this.store.dailySheets().filter((sheet) => sheet.sheetDate.slice(0, 10) === day);
  };

  public readonly todayHours = computed(() => sumHours(this.sheetsOn(this.selectedDate())));

  public readonly previousDayDelta = computed(() => {
    const previous = new Date(this.selectedDate());
    previous.setDate(previous.getDate() - 1);
    return this.todayHours() - sumHours(this.sheetsOn(previous));
  });

  public readonly pendingCount = computed(
    () => this.store.dailySheets().filter((sheet) => sheet.status === 'submitted').length
  );

  private readonly monthSheets = computed(() => {
    const month = isoMonth(this.selectedDate());
    return this.store.dailySheets().filter((sheet) => sheet.sheetDate.slice(0, 7) === month);
  });

  public readonly monthHours = computed(() => sumHours(this.monthSheets()));

  public readonly approvedMonthHours = computed(() =>
    sumHours(this.monthSheets().filter((sheet) => sheet.status === 'approved'))
  );

  public readonly approvedMonthPercent = computed(() =>
    percent(this.approvedMonthHours(), this.monthHours())
  );

  public readonly billableToday = computed(() =>
    round(
      this.sheetsOn(this.selectedDate()).reduce(
        (total, sheet) => total + (sheet.billableHours ?? sheet.hoursWorked),
        0
      )
    )
  );

  public readonly nonBillableToday = computed(() =>
    round(this.todayHours() - this.billableToday())
  );

  public readonly billablePercent = computed(() =>
    percent(this.billableToday(), this.todayHours())
  );

  // ---- Today's summary --------------------------------------------------

  /** Per-project slices of the selected day, pre-rolled into SVG dash offsets. */
  public readonly todaySlices = computed<Slice[]>(() => {
    const total = this.todayHours();
    if (!total) return [];

    const byProject = new Map<string, number>();
    for (const sheet of this.sheetsOn(this.selectedDate())) {
      const name = projectNameOf(sheet);
      byProject.set(name, (byProject.get(name) ?? 0) + sheet.hoursWorked);
    }

    let consumed = 0;
    return [...byProject.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, hours]) => {
        const share = hours / total;
        const slice: Slice = {
          name,
          hours: round(hours),
          percent: Math.round(share * 100),
          color: paletteFor(name),
          dash: `${share * DONUT_CIRCUMFERENCE} ${DONUT_CIRCUMFERENCE}`,
          offset: `${-consumed * DONUT_CIRCUMFERENCE}`,
        };
        consumed += share;
        return slice;
      });
  });

  public ngOnInit(): void {
    this.load();
  }

  // ---- interactions -----------------------------------------------------

  public shiftDay(days: number): void {
    const next = new Date(this.selectedDate());
    next.setDate(next.getDate() + days);
    this.selectedDate.set(next);
    this.load();
  }

  public setFilter(key: 'project' | 'status', value: string): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
  }

  public createSheet(): void {
    void this.router.navigate(['/freelancer-sheets/daily/new']);
  }

  public editSheet(id: string): void {
    void this.router.navigate(['/freelancer-sheets/daily', id, 'edit']);
  }

  public readonly statusPill = statusPill;

  private load(): void {
    const date = this.selectedDate();
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    this.store.loadDailySheets({ startDate: isoDay(monthStart), endDate: isoDay(date) });
  }

  private toRow(sheet: DailySheet): EntryRow {
    const project = projectNameOf(sheet);
    const breakMinutes = sheet.breakMinutes ?? 0;

    return {
      id: sheet.id,
      date: sheet.sheetDate,
      dateLabel: new Date(sheet.sheetDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      project,
      projectType: sheet.projectType ?? 'General',
      projectColor: paletteFor(project),
      projectInitials: initialsOf(project),
      task: sheet.taskName ?? sheet.tasksCompleted ?? 'Untitled task',
      description: sheet.description ?? '',
      start: sheet.startTime ?? '—',
      end: sheet.endTime ?? '—',
      breakLabel: breakMinutes ? `${breakMinutes}m` : '0m',
      hours: round(sheet.hoursWorked),
      status: sheet.status,
      statusLabel: statusLabel(sheet.status),
    };
  }
}

const projectNameOf = (sheet: DailySheet): string => sheet.projectName ?? 'Unassigned';

const sumHours = (sheets: DailySheet[]): number =>
  round(sheets.reduce((total, sheet) => total + sheet.hoursWorked, 0));

const round = (value: number): number => Math.round(value * 10) / 10;

const percent = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;
