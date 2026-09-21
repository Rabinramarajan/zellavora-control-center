import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DailySheet, SheetsStore } from '../../sheets.store';
import { initialsOf, isoDay, paletteFor, statusPill } from '../../sheets.presentation';

interface QueueRow {
  id: string;
  dateLabel: string;
  project: string;
  projectColor: string;
  projectInitials: string;
  task: string;
  hours: number;
  amount: number;
}

@Component({
  selector: 'app-approval-queue',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './approval-queue.component.html',
  styleUrls: ['../../styles/sheets-theme.css', './approval-queue.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalQueueComponent implements OnInit {
  private readonly store = inject(SheetsStore);

  public readonly isLoading = this.store.isLoading;
  public readonly error = this.store.error;
  public readonly statusPill = statusPill;

  /** Ids currently being acted on, so their buttons stay disabled. */
  public readonly busy = signal<ReadonlySet<string>>(new Set());

  private readonly pending = computed(() =>
    this.store.dailySheets().filter((sheet) => sheet.status === 'submitted')
  );

  public readonly rows = computed<QueueRow[]>(() =>
    [...this.pending()]
      .sort((a, b) => a.sheetDate.localeCompare(b.sheetDate))
      .map((sheet) => this.toRow(sheet))
  );

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

  public isBusy(id: string): boolean {
    return this.busy().has(id);
  }

  private toRow(sheet: DailySheet): QueueRow {
    const project = sheet.projectName ?? 'Unassigned';
    return {
      id: sheet.id,
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
