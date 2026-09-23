import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  ColumnDef,
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
} from '../../sheets.presentation';

/** One cell of the month calendar; `day` is 0 for the leading/trailing filler. */
interface CalendarCell {
  key: string;
  day: number;
  hours: number;
  status: SheetStatus | 'none';
  outside: boolean;
  isToday: boolean;
  label: string;
}

interface WeekBar {
  label: string;
  total: number;
  billable: number;
  nonBillable: number;
  /** Height percentages relative to the tallest week. */
  billableHeight: number;
  nonBillableHeight: number;
}

interface ProjectRow {
  name: string;
  initials: string;
  color: string;
  type: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  approvalPercent: number;
}

const PROJECT_COLUMNS: ColumnDef<ProjectRow>[] = [
  { key: 'name', header: 'Project', sortable: true },
  { key: 'type', header: 'Type', hidden: true },
  {
    key: 'totalHours',
    header: 'Total Hours',
    sortable: true,
    format: (value) => `${value}h`,
    cellClass: 'text-white font-semibold tabular-nums',
  },
  {
    key: 'billableHours',
    header: 'Billable Hours',
    sortable: true,
    format: (value) => `${value}h`,
    cellClass: 'text-slate-300 tabular-nums',
  },
  {
    key: 'nonBillableHours',
    header: 'Non-billable',
    sortable: true,
    format: (value) => `${value}h`,
    cellClass: 'text-slate-400 tabular-nums',
  },
  {
    key: 'approvalPercent',
    header: 'Approval',
    sortable: true,
    width: '14rem',
    format: (value) => `${value}%`,
  },
  { key: 'actions', header: 'Actions', align: 'right', exportable: false },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CALENDAR_LEGEND: { label: string; status: SheetStatus | 'none' }[] = [
  { label: 'Approved', status: 'approved' },
  { label: 'Pending', status: 'submitted' },
  { label: 'Draft', status: 'draft' },
  { label: 'No entry', status: 'none' },
];

@Component({
  selector: 'app-monthly-sheets',
  standalone: true,
  imports: [CommonModule, SmartTableComponent, SmartCellDirective, SmartEmptyDirective],
  templateUrl: './monthly-sheets.component.html',
  styleUrls: ['../../styles/sheets-theme.css', './monthly-sheets.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthlySheetsComponent implements OnInit {
  private readonly store = inject(SheetsStore);
  private readonly router = inject(Router);

  public readonly isLoading = this.store.isLoading;
  public readonly error = this.store.error;

  public readonly weekdays = WEEKDAYS;
  public readonly legend = CALENDAR_LEGEND;
  public readonly projectColumns = PROJECT_COLUMNS;
  public readonly projectSort = signal<SortState>({ key: 'totalHours', direction: 'desc' });
  public readonly trackProject = (row: ProjectRow): string => row.name;

  private readonly projectTable = viewChild.required<SmartTableComponent<ProjectRow>>('projectTable');

  /** Always the first of the displayed month. */
  public readonly month = signal(startOfMonth(new Date()));

  public readonly monthLabel = computed(() =>
    this.month().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );

  private readonly monthSheets = computed(() => {
    const key = isoMonth(this.month());
    return this.store.dailySheets().filter((sheet) => sheet.sheetDate.slice(0, 7) === key);
  });

  // ---- KPIs -------------------------------------------------------------

  public readonly totalHours = computed(() => sumHours(this.monthSheets()));

  public readonly billableHours = computed(() =>
    round(
      this.monthSheets().reduce(
        (total, sheet) => total + (sheet.billableHours ?? sheet.hoursWorked),
        0
      )
    )
  );

  public readonly billablePercent = computed(() =>
    percent(this.billableHours(), this.totalHours())
  );

  public readonly previousMonthChange = computed(() => {
    const previous = new Date(this.month());
    previous.setMonth(previous.getMonth() - 1);
    const key = isoMonth(previous);
    const before = sumHours(
      this.store.dailySheets().filter((sheet) => sheet.sheetDate.slice(0, 7) === key)
    );
    if (!before) return null;
    return Math.round(((this.totalHours() - before) / before) * 100);
  });

  public readonly workingDays = computed(
    () => new Set(this.monthSheets().map((sheet) => sheet.sheetDate.slice(0, 10))).size
  );

  public readonly daysInMonth = computed(() =>
    new Date(this.month().getFullYear(), this.month().getMonth() + 1, 0).getDate()
  );

  public readonly totalSheets = computed(() => this.monthSheets().length);

  public readonly approvedSheets = computed(
    () => this.monthSheets().filter((sheet) => sheet.status === 'approved').length
  );

  public readonly approvalPercent = computed(() =>
    percent(this.approvedSheets(), this.totalSheets())
  );

  /** Dash array for the r=26 approval ring. */
  public readonly ringCircumference = 2 * Math.PI * 26;

  public readonly ringDash = computed(
    () => `${(this.approvalPercent() / 100) * this.ringCircumference} ${this.ringCircumference}`
  );

  // ---- calendar ---------------------------------------------------------

  public readonly calendar = computed<CalendarCell[]>(() => {
    const first = this.month();
    const year = first.getFullYear();
    const monthIndex = first.getMonth();
    const leading = first.getDay();
    const days = this.daysInMonth();
    const today = isoDay(new Date());

    const byDay = new Map<string, { hours: number; status: SheetStatus }>();
    for (const sheet of this.monthSheets()) {
      const key = sheet.sheetDate.slice(0, 10);
      const existing = byDay.get(key);
      byDay.set(key, {
        hours: (existing?.hours ?? 0) + sheet.hoursWorked,
        // A day is only as settled as its least-settled sheet.
        status: existing ? leastSettled(existing.status, sheet.status) : sheet.status,
      });
    }

    const cells: CalendarCell[] = [];

    for (let i = leading; i > 0; i--) {
      const date = new Date(year, monthIndex, 1 - i);
      cells.push(fillerCell(date));
    }

    for (let day = 1; day <= days; day++) {
      const date = new Date(year, monthIndex, day);
      const key = isoDay(date);
      const entry = byDay.get(key);
      cells.push({
        key,
        day,
        hours: round(entry?.hours ?? 0),
        status: entry?.status ?? 'none',
        outside: false,
        isToday: key === today,
        label: date.toLocaleDateString('en-US', { dateStyle: 'medium' }),
      });
    }

    // Pad the final row so the grid stays rectangular.
    while (cells.length % 7 !== 0) {
      const date = new Date(year, monthIndex, days + (cells.length % 7));
      cells.push(fillerCell(date));
    }

    return cells;
  });

  // ---- weekly overview --------------------------------------------------

  public readonly weekBars = computed<WeekBar[]>(() => {
    const cells = this.calendar().filter((cell) => !cell.outside);
    const billableShare = this.totalHours() ? this.billableHours() / this.totalHours() : 0;

    const weeks: WeekBar[] = [];
    for (let index = 0; index * 7 < this.calendar().length; index++) {
      const slice = this.calendar()
        .slice(index * 7, index * 7 + 7)
        .filter((c) => !c.outside);
      if (!slice.length) continue;
      const total = round(slice.reduce((sum, cell) => sum + cell.hours, 0));
      const billable = round(total * billableShare);
      weeks.push({
        label: `W${weeks.length + 1}`,
        total,
        billable,
        nonBillable: round(total - billable),
        billableHeight: 0,
        nonBillableHeight: 0,
      });
    }

    const peak = Math.max(...weeks.map((week) => week.total), 1);
    for (const week of weeks) {
      week.billableHeight = (week.billable / peak) * 100;
      week.nonBillableHeight = (week.nonBillable / peak) * 100;
    }

    return cells.length ? weeks : [];
  });

  // ---- project summary --------------------------------------------------

  public readonly projectRows = computed<ProjectRow[]>(() => {
    const grouped = new Map<string, DailySheet[]>();
    for (const sheet of this.monthSheets()) {
      const name = sheet.projectName ?? 'Unassigned';
      grouped.set(name, [...(grouped.get(name) ?? []), sheet]);
    }

    return [...grouped.entries()]
      .map(([name, sheets]) => {
        const totalHours = sumHours(sheets);
        const billable = round(
          sheets.reduce((total, sheet) => total + (sheet.billableHours ?? sheet.hoursWorked), 0)
        );
        return {
          name,
          initials: initialsOf(name),
          color: paletteFor(name),
          type: sheets[0].projectType ?? 'General',
          totalHours,
          billableHours: billable,
          nonBillableHours: round(totalHours - billable),
          approvalPercent: percent(
            sheets.filter((sheet) => sheet.status === 'approved').length,
            sheets.length
          ),
        };
      });
  });

  public ngOnInit(): void {
    this.load();
  }

  public shiftMonth(months: number): void {
    const next = new Date(this.month());
    next.setMonth(next.getMonth() + months);
    this.month.set(startOfMonth(next));
    this.load();
  }

  public export(): void {
    this.projectTable().exportCsv(`monthly-sheet-${isoMonth(this.month())}`);
  }

  public openProject(name: string): void {
    void this.router.navigate(['/freelancer-sheets/daily/list'], {
      queryParams: { project: name, month: isoMonth(this.month()) },
    });
  }

  public cellClass(cell: CalendarCell): string {
    if (cell.outside) return 'cal-cell cal-cell--outside';
    return `cal-cell cal-cell--${cell.status}${cell.isToday ? ' cal-cell--today' : ''}`;
  }

  public statusText(status: SheetStatus | 'none'): string {
    return status === 'none' ? 'No entry' : statusLabel(status);
  }

  private load(): void {
    const month = this.month();
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    this.store.loadDailySheets({ startDate: isoDay(month), endDate: isoDay(end) });
    this.store.loadMonthlySheets({ month: month.getMonth() + 1, year: month.getFullYear() });
  }
}

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

const fillerCell = (date: Date): CalendarCell => ({
  key: isoDay(date),
  day: date.getDate(),
  hours: 0,
  status: 'none',
  outside: true,
  isToday: false,
  label: date.toLocaleDateString('en-US', { dateStyle: 'medium' }),
});

/** Draft < Pending < Approved — the calendar shows the weakest state of the day. */
const SETTLEMENT_ORDER: SheetStatus[] = ['rejected', 'draft', 'submitted', 'approved', 'paid'];

const leastSettled = (a: SheetStatus, b: SheetStatus): SheetStatus =>
  SETTLEMENT_ORDER.indexOf(a) <= SETTLEMENT_ORDER.indexOf(b) ? a : b;

const sumHours = (sheets: DailySheet[]): number =>
  round(sheets.reduce((total, sheet) => total + sheet.hoursWorked, 0));

const round = (value: number): number => Math.round(value * 10) / 10;

const percent = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;
