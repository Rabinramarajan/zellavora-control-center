import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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

const ROWS_PER_PAGE_OPTIONS = [6, 12, 24, 50];

/** Circumference of the r=54 donut ring used in Today's Summary. */
const DONUT_CIRCUMFERENCE = 2 * Math.PI * 54;

@Component({
  selector: 'app-daily-sheets',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  public readonly search = signal('');
  public readonly projectFilter = signal('all');
  public readonly statusFilter = signal('all');
  public readonly page = signal(1);
  public readonly rowsPerPage = signal(6);
  public readonly rowsPerPageOptions = ROWS_PER_PAGE_OPTIONS;

  public readonly selectedDateLabel = computed(() =>
    this.selectedDate().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  );

  /** Every sheet mapped to a table row, newest day first. */
  private readonly rows = computed<EntryRow[]>(() =>
    [...this.store.dailySheets()]
      .sort((a, b) => b.sheetDate.localeCompare(a.sheetDate))
      .map((sheet) => this.toRow(sheet))
  );

  public readonly projectOptions = computed(() => {
    const names = new Set(this.rows().map((row) => row.project));
    return [...names].sort((a, b) => a.localeCompare(b));
  });

  public readonly filteredRows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const project = this.projectFilter();
    const status = this.statusFilter();

    return this.rows().filter((row) => {
      if (project !== 'all' && row.project !== project) return false;
      if (status !== 'all' && row.status !== status) return false;
      if (!term) return true;
      return (
        row.task.toLowerCase().includes(term) ||
        row.description.toLowerCase().includes(term) ||
        row.project.toLowerCase().includes(term)
      );
    });
  });

  public readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRows().length / this.rowsPerPage()))
  );

  public readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));

  public readonly pagedRows = computed(() => {
    const start = (this.currentPage() - 1) * this.rowsPerPage();
    return this.filteredRows().slice(start, start + this.rowsPerPage());
  });

  /** Page numbers around the current one, with `-1` standing in for an ellipsis. */
  public readonly pageNumbers = computed<number[]>(() => {
    const total = this.totalPages();
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

    const current = this.currentPage();
    const window = new Set([1, total, current, current - 1, current + 1]);
    const pages = [...window].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);

    return pages.flatMap((n, i) => (i > 0 && n - pages[i - 1] > 1 ? [-1, n] : [n]));
  });

  public readonly rangeLabel = computed(() => {
    const total = this.filteredRows().length;
    if (!total) return 'No entries to show';
    const first = (this.currentPage() - 1) * this.rowsPerPage() + 1;
    const last = Math.min(first + this.rowsPerPage() - 1, total);
    return `Showing ${first} to ${last} of ${total} entries`;
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

  public onFilterChange(): void {
    this.page.set(1);
  }

  public goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.page.set(page);
  }

  public setRowsPerPage(rows: number): void {
    this.rowsPerPage.set(Number(rows));
    this.page.set(1);
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
