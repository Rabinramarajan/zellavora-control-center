import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ColumnDef,
  SmartCellDirective,
  SmartEmptyDirective,
  SmartTableComponent,
  SortState,
} from '../../../../shared/components/smart-table';
import { DailySheet, SheetsStore } from '../../sheets.store';
import { initialsOf, isoDay, paletteFor } from '../../sheets.presentation';

interface QueueRow {
  id: string;
  date: string;
  dateLabel: string;
  project: string;
  projectColor: string;
  projectInitials: string;
  task: string;
  hours: number;
  amount: number;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const QUEUE_COLUMNS: ColumnDef<QueueRow>[] = [
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

@Component({
  selector: 'app-approval-queue',
  standalone: true,
  imports: [CommonModule, SmartTableComponent, SmartCellDirective, SmartEmptyDirective],
  templateUrl: './approval-queue.component.html',
  styleUrls: ['../../styles/sheets-theme.css', './approval-queue.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalQueueComponent implements OnInit {
  private readonly store = inject(SheetsStore);

  public readonly isLoading = this.store.isLoading;
  public readonly error = this.store.error;

  public readonly columns = QUEUE_COLUMNS;
  public readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  public readonly sort = signal<SortState>({ key: 'date', direction: 'asc' });
  public readonly pageSize = signal(PAGE_SIZE_OPTIONS[0]);
  public readonly selected = signal<readonly QueueRow[]>([]);

  /** Ids currently being acted on, so their buttons stay disabled. */
  public readonly busy = signal<ReadonlySet<string>>(new Set());

  public readonly selectionBusy = computed(() =>
    this.selected().some((row) => this.busy().has(row.id))
  );

  private readonly pending = computed(() =>
    this.store.dailySheets().filter((sheet) => sheet.status === 'submitted')
  );

  public readonly rows = computed<QueueRow[]>(() => this.pending().map((sheet) => this.toRow(sheet)));

  public readonly totalHours = computed(
    () =>
      Math.round(this.pending().reduce((total, sheet) => total + sheet.hoursWorked, 0) * 10) / 10
  );

  public readonly totalAmount = computed(() =>
    this.pending().reduce((total, sheet) => total + (sheet.totalAmount ?? 0), 0)
  );

  public ngOnInit(): void {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    this.store.loadDailySheets({ startDate: isoDay(start), endDate: isoDay(now) });
  }

  public decide(id: string, approved: boolean): void {
    this.busy.update((set) => new Set(set).add(id));
    this.store.approveDailySheet(
      id,
      approved,
      approved ? undefined : 'Rejected from approval queue'
    );
  }

  public decideSelected(approved: boolean): void {
    for (const row of this.selected()) {
      if (!this.isBusy(row.id)) this.decide(row.id, approved);
    }
  }

  public isBusy(id: string): boolean {
    return this.busy().has(id);
  }

  private toRow(sheet: DailySheet): QueueRow {
    const project = sheet.projectName ?? 'Unassigned';
    return {
      id: sheet.id,
      date: sheet.sheetDate,
      dateLabel: new Date(sheet.sheetDate).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      project,
      projectColor: paletteFor(project),
      projectInitials: initialsOf(project),
      task: sheet.taskName ?? sheet.tasksCompleted ?? sheet.description ?? 'Untitled task',
      hours: Math.round(sheet.hoursWorked * 10) / 10,
      amount: sheet.totalAmount ?? 0,
    };
  }
}
