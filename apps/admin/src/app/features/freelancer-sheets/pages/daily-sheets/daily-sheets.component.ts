import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ColumnDef,
  FilterState,
  SmartCellDirective,
  SmartEmptyDirective,
  SmartTableComponent,
  SortState,
} from '../../../../shared/components/smart-table';
import { SheetsStore } from '../../sheets.store';
import { DailySheet } from '../../sheets.models';
import { isDayKey, parseDayKey } from '../../sheets.time';
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
  /** Draft or rejected: the owner can still change it. */
  editable: boolean;
  rejectionReason: string | null;
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
  providers: [SheetsStore],
  templateUrl: './daily-sheets.component.html',
  styleUrls: ['../../styles/sheets-theme.css', './daily-sheets.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailySheetsComponent implements OnInit {
  private readonly store = inject(SheetsStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  public readonly isLoading = this.store.isLoading;
  public readonly error = this.store.error;

  public readonly selectedDate = signal(new Date());
  public readonly selectedDayKey = computed(() => isoDay(this.selectedDate()));

  /** Weekends are off unless work is logged, so an empty one is not a gap. */
  public readonly isWeekend = computed(() => {
    const weekday = this.selectedDate().getDay();
    return weekday === 0 || weekday === 6;
  });

  /** Ids with a submit in flight, so their buttons stay disabled. */
  private readonly busy = signal<ReadonlySet<string>>(new Set());

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

  /** The table lists the selected month; the extra day loaded is for KPIs only. */
  public readonly rows = computed<EntryRow[]>(() => {
    const month = isoMonth(this.selectedDate());
    return this.store
      .dailySheets()
      .filter((sheet) => sheet.sheetDate.startsWith(month))
      .map((sheet) => this.toRow(sheet));
  });

  public readonly draftCount = computed(
    () => this.rows().filter((row) => row.status === 'draft').length
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
    () => this.rows().filter((row) => row.status === 'submitted').length
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
    for (const sheet of this.sheetsOn(this.selectedDate()).filter((s) => s.entryType === 'work')) {
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

  /**
   * `?date=` and `?project=` seed the page, so a link from the monthly view
   * or a return from the form lands on the right day and filter.
   */
  public ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const date = params.get('date');
    if (isDayKey(date)) this.selectedDate.set(parseDayKey(date));
    const project = params.get('project');
    if (project) this.filters.update((filters) => ({ ...filters, project }));
    void this.load();
  }

  // ---- interactions -----------------------------------------------------

  public shiftDay(days: number): void {
    const next = new Date(this.selectedDate());
    next.setDate(next.getDate() + days);
    this.selectDate(next);
  }

  public goToday(): void {
    this.selectDate(new Date());
  }

  public pickDate(value: string): void {
    if (isDayKey(value)) this.selectDate(parseDayKey(value));
  }

  public setFilter(key: 'project' | 'status', value: string): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
  }

  public createSheet(): void {
    void this.router.navigate(['/freelancer-sheets/daily/new'], {
      queryParams: { date: isoDay(this.selectedDate()) },
    });
  }

  public openSheet(row: EntryRow): void {
    void this.router.navigate(
      row.editable
        ? ['/freelancer-sheets/daily', row.id, 'edit']
        : ['/freelancer-sheets/daily', row.id]
    );
  }

  public async submitSheet(row: EntryRow): Promise<void> {
    this.busy.update((ids) => new Set(ids).add(row.id));
    try {
      await this.store.submitDailySheet(row.id);
    } catch {
      // The store has already told the user why.
    } finally {
      this.busy.update((ids) => {
        const next = new Set(ids);
        next.delete(row.id);
        return next;
      });
    }
  }

  public isBusy(id: string): boolean {
    return this.busy().has(id);
  }

  public reload(): void {
    void this.load();
  }

  public readonly statusPill = statusPill;

  private selectDate(date: Date): void {
    const monthChanged = isoMonth(date) !== isoMonth(this.selectedDate());
    this.selectedDate.set(date);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { date: isoDay(date) },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (monthChanged) void this.load();
  }

  /**
   * The whole selected month plus the day before it, so "from yesterday"
   * still has a comparison on the 1st.
   */
  private load(): Promise<void> {
    const date = this.selectedDate();
    const start = new Date(date.getFullYear(), date.getMonth(), 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return this.store.loadDailySheets({
      scope: 'mine',
      startDate: isoDay(start),
      endDate: isoDay(end),
    });
  }

  private toRow(sheet: DailySheet): EntryRow {
    const project = projectNameOf(sheet);
    const absence =
      sheet.entryType === 'leave' ? 'Leave' : sheet.entryType === 'holiday' ? 'Holiday' : null;
    const task = absence ?? sheet.taskName ?? sheet.description ?? 'Untitled task';

    return {
      id: sheet.id,
      date: sheet.sheetDate,
      dateLabel: parseDayKey(sheet.sheetDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      project,
      projectType: absence ? 'Day off' : sheet.isBillable ? 'Billable' : 'Non-billable',
      projectColor: paletteFor(project),
      projectInitials: initialsOf(project),
      task,
      description: (absence || sheet.taskName) && sheet.description ? sheet.description : '',
      start: sheet.startTime ?? '—',
      end: sheet.endTime ?? '—',
      breakLabel: sheet.breakMinutes ? `${sheet.breakMinutes}m` : '—',
      hours: round(sheet.hoursWorked),
      status: sheet.status,
      statusLabel: statusLabel(sheet.status),
      editable: sheet.status === 'draft' || sheet.status === 'rejected',
      rejectionReason: sheet.rejectionReason,
    };
  }
}

const projectNameOf = (sheet: DailySheet): string => sheet.projectName ?? 'Unassigned';

const sumHours = (sheets: DailySheet[]): number =>
  round(sheets.reduce((total, sheet) => total + sheet.hoursWorked, 0));

const round = (value: number): number => Math.round(value * 10) / 10;

const percent = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;
