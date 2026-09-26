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
import { SheetsStore } from '../../sheets.store';
import { DailySheet, MonthlySheet } from '../../sheets.models';
import { initialsOf, paletteFor, statusLabel, statusPill } from '../../sheets.presentation';
import { parseDayKey } from '../../sheets.time';
import { AuthStore } from '../../../../core/auth/auth.store';

interface DailyRow {
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
 * the API enforces the same permission and refuses self-review.
 */
@Component({
  selector: 'app-approval-queue',
  standalone: true,
  imports: [CommonModule, RouterLink, SmartTableComponent, SmartCellDirective, SmartEmptyDirective],
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
      .filter((sheet) => sheet.status === 'submitted')
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
    () => Math.round(this.dailyRows().reduce((total, row) => total + row.hours, 0) * 10) / 10
  );

  public readonly dailyAmount = computed(() =>
    this.dailyRows().reduce((total, row) => total + row.amount, 0)
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
    this.tab.set(tab);
    this.selectedDaily.set([]);
    this.cancelRejection();
    this.reload();
  }

  public reload(): void {
    if (this.tab() === 'monthly') {
      void this.store.loadMonthlySheets({ scope: 'team', pageSize: 200 });
    } else {
      void this.store.loadDailySheets({ scope: 'team', status: 'submitted' });
    }
  }

  public isBusy(id: string): boolean {
    return this.busyIds().has(id);
  }

  public approveDaily(ids: readonly string[]): void {
    for (const id of ids) {
      if (!this.dailyRows().some((row) => row.id === id && this.canReviewOwner(row.userId))) continue;
      void this.decide(id, () => this.store.reviewDailySheet(id, true));
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
    ids = ids.filter((id) => rows.some((row) => row.id === id && this.canReviewOwner(row.userId)));
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

    for (const id of pending.ids) {
      const rows = pending.kind === 'daily' ? this.dailyRows() : this.monthlyRows();
      if (!rows.some((row) => row.id === id && this.canReviewOwner(row.userId))) continue;
      void this.decide(id, () =>
        pending.kind === 'daily'
          ? this.store.reviewDailySheet(id, false, reason)
          : this.store.reviewMonthlySheet(id, false, reason)
      );
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
