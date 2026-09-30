import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ColumnDef,
  SmartCellDirective,
  SmartEmptyDirective,
  SmartTableComponent,
  SortState,
} from '../../../../shared/components/smart-table';
import { DateRangePickerComponent } from '../../../../shared/components/date-range-picker/date-range-picker.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { SheetsStore } from '../../sheets.store';
import { DailySheet, MonthlySheet } from '../../sheets.models';
import { initialsOf, paletteFor, statusLabel, statusPill } from '../../sheets.presentation';
import { parseDayKey } from '../../sheets.time';
import { AuthStore } from '../../../../core/auth/auth.store';

interface DailyRow {
  status: DailySheet['status'];
  userId: string;
  id: string;
  employee: string;
  date: string;
  dateLabel: string;
  project: string;
  projectColor: string;
  projectInitials: string;
  task: string;
  hours: number;
  amount: number;
}

interface MonthlyRow {
  id: string;
  userId: string;
  employee: string;
  period: string;
  month: number;
  year: number;
  hours: number;
  workingDays: number;
  amount: number;
  status: MonthlySheet['status'];
}

type QueueTab = 'daily' | 'monthly';

/** A rejection waiting for its reason: one or more sheets of one kind. */
interface PendingRejection {
  kind: QueueTab;
  ids: string[];
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const DAILY_COLUMNS: ColumnDef<DailyRow>[] = [
  { key: 'employee', header: 'Employee', sortable: true },
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
    header: 'Task',
    sortable: true,
    cellClass: 'text-slate-300 max-w-[18rem] whitespace-normal',
  },
  {
    key: 'hours',
    header: 'Hours',
    sortable: true,
    format: (value) => `${value}h`,
    cellClass: 'text-white font-semibold tabular-nums',
  },
  {
    key: 'amount',
    header: 'Amount',
    sortable: true,
    format: (value) => currency.format(Number(value)),
    cellClass: 'text-slate-300 tabular-nums',
  },
  { key: 'actions', header: 'Decision', align: 'right', exportable: false },
];

const MONTHLY_COLUMNS: ColumnDef<MonthlyRow>[] = [
  { key: 'employee', header: 'Employee', sortable: true },
  { key: 'period', header: 'Month', sortable: true, cellClass: 'text-slate-300' },
  {
    key: 'hours',
    header: 'Hours',
    sortable: true,
    format: (value) => `${value}h`,
    cellClass: 'text-white font-semibold tabular-nums',
  },
  { key: 'workingDays', header: 'Days', sortable: true, cellClass: 'tabular-nums' },
  {
    key: 'amount',
    header: 'Amount',
    sortable: true,
    format: (value) => currency.format(Number(value)),
    cellClass: 'text-slate-300 tabular-nums',
  },
  { key: 'status', header: 'Status', sortable: true },
  { key: 'actions', header: 'Decision', align: 'right', exportable: false },
];

/**
 * Reviewer queue for the whole team: submitted daily sheets, and monthly
 * sheets waiting for approval or payment. Guarded by `timesheet:approve`;
 * the API enforces the same permission, with an owner self-review exception.
 */
@Component({
  selector: 'app-approval-queue',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    SmartTableComponent,
    SmartCellDirective,
    SmartEmptyDirective,
    DateRangePickerComponent,
    PaginationComponent,
  ],
  providers: [SheetsStore],
  templateUrl: './approval-queue.component.html',
  styleUrls: ['../../styles/sheets-theme.css', './approval-queue.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalQueueComponent implements OnInit {
  private readonly store = inject(SheetsStore);
  private readonly auth = inject(AuthStore);

  public canReviewOwner(userId: string): boolean {
    const currentUserId = this.auth.user()?.id;
    return !!currentUserId && (userId !== currentUserId || this.auth.role() === 'owner');
  }

  public readonly isLoading = this.store.isLoading;
  public readonly error = this.store.error;

  public readonly tab = signal<QueueTab>('daily');
  public readonly search = signal('');
  public readonly projectFilter = signal('');
  public readonly memberFilter = signal('');
  public readonly statusFilter = signal('submitted');
  public readonly dateFrom = signal('');
  public readonly dateTo = signal('');
  public readonly page = signal(1);
  public readonly newestFirst = signal(false);
  public readonly collapsed = signal<ReadonlySet<string>>(new Set());
  public readonly initials = initialsOf;
  public readonly loadedMonthly = signal(false);
  public readonly projects = computed(() => [...new Set(this.dailyRows().map(row => row.project))].sort());
  public readonly members = computed(() => {
    const rows = this.tab() === 'daily' ? this.dailyRows() : this.monthlyRows();
    return [...new Map(rows.map(row => [row.userId, row.employee])).entries()];
  });
  public readonly pendingDaily = computed(() => this.dailyRows().filter(row => row.status === 'submitted'));
  public readonly filteredDaily = computed(() => this.dailyRows().filter(row =>
    (!this.search() || `${row.employee} ${row.project} ${row.task}`.toLowerCase().includes(this.search().toLowerCase())) &&
    (!this.projectFilter() || row.project === this.projectFilter()) &&
    (!this.memberFilter() || row.userId === this.memberFilter()) &&
    (!this.statusFilter() || row.status === this.statusFilter()) &&
    (!this.dateFrom() || row.date >= this.dateFrom()) &&
    (!this.dateTo() || row.date <= this.dateTo())
  ).sort((a, b) => this.newestFirst() ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  public readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredDaily().length / this.pageSize())));
  public readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));
  public readonly visibleDaily = computed(() => this.filteredDaily().slice((this.currentPage() - 1) * this.pageSize(), this.currentPage() * this.pageSize()));
  public readonly groups = computed(() => {
    const groups = new Map<string, DailyRow[]>();
    for (const row of this.visibleDaily()) groups.set(row.date, [...(groups.get(row.date) ?? []), row]);
    return [...groups.entries()].map(([date, rows]) => ({ date, label: rows[0].dateLabel, rows }));
  });
  public readonly filteredMonthly = computed(() => this.monthlyRows().filter(row =>
    (!this.search() || `${row.employee} ${row.period}`.toLowerCase().includes(this.search().toLowerCase())) &&
    (!this.memberFilter() || row.userId === this.memberFilter()) &&
    (!this.statusFilter() || row.status === this.statusFilter()) &&
    (!this.dateFrom() || row.period >= this.dateFrom().slice(0, 7)) &&
    (!this.dateTo() || row.period <= this.dateTo().slice(0, 7))
  ));
  public isSelected(id: string): boolean { return this.selectedDaily().some(row => row.id === id); }
  public readonly allSelected = computed(() => {
    const rows = this.visibleDaily().filter(row => row.status === 'submitted' && this.canReviewOwner(row.userId));
    return rows.length > 0 && rows.every(row => this.isSelected(row.id));
  });
  public toggleRow(row: DailyRow): void {
    this.selectedDaily.update(rows => this.isSelected(row.id) ? rows.filter(item => item.id !== row.id) : [...rows, row]);
  }
  public toggleAll(): void {
    const rows = this.visibleDaily().filter(row => row.status === 'submitted' && this.canReviewOwner(row.userId));
    this.selectedDaily.set(this.allSelected() ? [] : rows);
  }
  public toggleGroup(date: string): void {
    this.collapsed.update(value => { const next = new Set(value); next.has(date) ? next.delete(date) : next.add(date); return next; });
  }
  public readonly activeFilterCount = computed(() =>
    [this.search(), this.projectFilter(), this.memberFilter(), this.statusFilter(), this.dateFrom() || this.dateTo()]
      .filter(Boolean).length
  );
  public readonly selectableCount = computed(() =>
    this.visibleDaily().filter(row => row.status === 'submitted' && this.canReviewOwner(row.userId)).length
  );
  public clearFilters(): void {
    this.search.set(''); this.projectFilter.set(''); this.memberFilter.set(''); this.statusFilter.set('');
    this.dateFrom.set(''); this.dateTo.set(''); this.page.set(1); this.selectedDaily.set([]);
  }
  public readonly dailyColumns = DAILY_COLUMNS;
  public readonly monthlyColumns = MONTHLY_COLUMNS;
  public readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  public readonly dailySort = signal<SortState>({ key: 'date', direction: 'asc' });
  public readonly monthlySort = signal<SortState>({ key: 'period', direction: 'asc' });
  public readonly pageSize = signal(PAGE_SIZE_OPTIONS[0]);
  public readonly selectedDaily = signal<readonly DailyRow[]>([]);

  /** Ids with a decision in flight, so their buttons stay disabled. */
  private readonly busyIds = signal<ReadonlySet<string>>(new Set());

  public readonly rejection = signal<PendingRejection | null>(null);
  public readonly rejectionReason = signal('');

  public readonly dailyRows = computed<DailyRow[]>(() =>
    this.store
      .dailySheets()
      .map((sheet) => this.toDailyRow(sheet))
  );

  public readonly monthlyRows = computed<MonthlyRow[]>(() =>
    this.store
      .monthlySheets()
      .filter((sheet) =>
        sheet.status === 'submitted' || sheet.status === 'approved'
      )
      .map((sheet) => this.toMonthlyRow(sheet))
  );

  public readonly pendingMonthly = computed(
    () => this.monthlyRows().filter((row) => row.status === 'submitted').length
  );

  public readonly awaitingPayment = computed(
    () => this.monthlyRows().filter((row) => row.status === 'approved').length
  );

  public readonly dailyHours = computed(
    () => Math.round(this.pendingDaily().reduce((total, row) => total + row.hours, 0) * 10) / 10
  );

  public readonly dailyAmount = computed(() =>
    this.pendingDaily().reduce((total, row) => total + row.amount, 0)
  );

  public readonly selectionBusy = computed(() =>
    this.selectedDaily().some((row) => this.busyIds().has(row.id)) ||
    !this.selectedDaily().some((row) => this.canReviewOwner(row.userId))
  );

  public readonly statusLabel = statusLabel;
  public readonly statusPill = statusPill;

  public ngOnInit(): void {
    this.reload();
  }

  public selectTab(tab: QueueTab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.clearFilters();
    this.statusFilter.set('submitted');
    this.selectedDaily.set([]);
    this.cancelRejection();
    this.reload();
  }

  public reload(): void {
    if (this.tab() === 'monthly') {
      void this.store.loadMonthlySheets({ scope: 'team', pageSize: 200 }).then(() => this.loadedMonthly.set(true));
    } else {
      void this.store.loadDailySheets({ scope: 'team' });
    }
  }

  public isBusy(id: string): boolean {
    return this.busyIds().has(id);
  }

  public approveDaily(ids: readonly string[]): void {
    void this.reviewDailyBatch(ids, true);
  }

  private async reviewDailyBatch(ids: readonly string[], approved: boolean, reason?: string): Promise<void> {
    const eligible = [...new Set(ids)].filter((id) => !this.isBusy(id) &&
      this.dailyRows().some((row) => row.id === id && row.status === 'submitted' && this.canReviewOwner(row.userId)));
    if (!eligible.length) return;
    this.busyIds.update((busy) => new Set([...busy, ...eligible]));
    try {
      await this.store.reviewDailyBulk(eligible, approved, reason);
      this.selectedDaily.set([]);
    } catch {
      // HTTP errors are displayed by the global error interceptor.
    } finally {
      this.busyIds.update((busy) => new Set([...busy].filter((id) => !eligible.includes(id))));
    }
  }

  public approveSelected(): void {
    this.approveDaily(this.selectedDaily().map((row) => row.id));
  }

  public rejectSelected(): void {
    this.startRejection(
      'daily',
      this.selectedDaily().map((row) => row.id)
    );
  }

  public approveMonthly(id: string): void {
    if (!this.monthlyRows().some((row) => row.id === id && row.status === 'submitted' && this.canReviewOwner(row.userId))) return;
    void this.decide(id, () => this.store.reviewMonthlySheet(id, true));
  }

  public markPaid(id: string): void {
    void this.decide(id, () => this.store.markMonthlySheetAsPaid(id));
  }

  /** Rejecting always asks why: the freelancer needs to know what to fix. */
  public startRejection(kind: QueueTab, ids: readonly string[]): void {
    const rows = kind === 'daily' ? this.dailyRows() : this.monthlyRows();
    ids = ids.filter((id) => rows.some((row) => row.id === id && row.status === 'submitted' && this.canReviewOwner(row.userId)));
    if (!ids.length) return;
    this.rejectionReason.set('');
    this.rejection.set({ kind, ids: [...ids] });
  }

  public cancelRejection(): void {
    this.rejection.set(null);
  }

  public confirmRejection(): void {
    const pending = this.rejection();
    const reason = this.rejectionReason().trim();
    if (!pending || !reason) return;
    this.rejection.set(null);

    if (pending.kind === 'daily') {
      void this.reviewDailyBatch(pending.ids, false, reason);
      return;
    }

    for (const id of pending.ids) {
      const rows = this.monthlyRows();
      if (!rows.some((row) => row.id === id && this.canReviewOwner(row.userId))) continue;
      void this.decide(id, () => this.store.reviewMonthlySheet(id, false, reason));
    }
  }

  private async decide(id: string, action: () => Promise<unknown>): Promise<void> {
    if (this.isBusy(id)) return;
    this.busyIds.update((ids) => new Set(ids).add(id));
    try {
      await action();
    } catch {
      // The store has already told the reviewer why.
    } finally {
      this.busyIds.update((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    }
  }

  private toDailyRow(sheet: DailySheet): DailyRow {
    const project = sheet.projectName ?? 'Unassigned';
    const absence =
      sheet.entryType === 'leave' ? 'Leave' : sheet.entryType === 'holiday' ? 'Holiday' : null;
    return {
      id: sheet.id,
      status: sheet.status,
      userId: sheet.userId,
      employee: sheet.user?.fullName ?? 'Unknown',
      date: sheet.sheetDate,
      dateLabel: parseDayKey(sheet.sheetDate).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      project,
      projectColor: paletteFor(project),
      projectInitials: initialsOf(project),
      task: absence ?? sheet.taskName ?? sheet.description ?? 'Untitled task',
      hours: Math.round(sheet.hoursWorked * 10) / 10,
      amount: sheet.totalAmount,
    };
  }

  private toMonthlyRow(sheet: MonthlySheet): MonthlyRow {
    return {
      id: sheet.id,
      userId: sheet.userId,
      employee: sheet.user?.fullName ?? 'Unknown',
      period: `${sheet.year}-${String(sheet.month).padStart(2, '0')}`,
      month: sheet.month,
      year: sheet.year,
      hours: sheet.totalHours,
      workingDays: sheet.workingDays,
      amount: sheet.totalAmount,
      status: sheet.status,
    };
  }
}
