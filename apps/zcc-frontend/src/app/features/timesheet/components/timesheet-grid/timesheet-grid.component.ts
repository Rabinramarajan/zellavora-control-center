import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { TimesheetService } from '../../data/timesheet.service';
import {
  BulkEntryPatch,
  EntryStatus,
  TimesheetEntry,
  formatPeriod,
} from '../../data/timesheet.model';
import { DayStatusPipe, ENTRY_STATUS_OPTIONS } from '../../pipes/day-status.pipe';
import { TimesheetSummaryCardComponent } from '../timesheet-summary-card/timesheet-summary-card.component';
import { TimesheetApprovalPanelComponent } from '../timesheet-approval-panel/timesheet-approval-panel.component';

/** A row plus the presentation flags the template needs. */
interface GridRow {
  entry: TimesheetEntry;
  isWeekend: boolean;
  /** Leave and holiday days take no hours or clock times. */
  isNonWorking: boolean;
}

@Component({
  selector: 'app-timesheet-grid',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    ToastModule,
    DayStatusPipe,
    TimesheetSummaryCardComponent,
    TimesheetApprovalPanelComponent,
  ],
  templateUrl: './timesheet-grid.component.html',
  styleUrl: './timesheet-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesheetGridComponent {
  protected readonly service = inject(TimesheetService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // p-select takes a mutable array, so the shared readonly list is copied.
  protected readonly statusOptions = [...ENTRY_STATUS_OPTIONS];

  protected readonly autoFillOpen = signal(false);
  protected readonly isExporting = signal(false);
  protected readonly fillStart = signal('09:00');
  protected readonly fillEnd = signal('17:30');
  protected readonly fillHours = signal(8);

  /** Two-way binding target for p-dialog's `visible`. */
  protected get autoFillOpenModel(): boolean {
    return this.autoFillOpen();
  }
  protected set autoFillOpenModel(value: boolean) {
    this.autoFillOpen.set(value);
  }

  protected readonly rows = computed<GridRow[]>(() =>
    this.service.entries().map((entry) => ({
      entry,
      isWeekend: entry.dayOfWeek === 'Saturday' || entry.dayOfWeek === 'Sunday',
      isNonWorking: entry.status === 'LEAVE' || entry.status === 'HOLIDAY',
    }))
  );

  protected readonly periodLabel = computed(() => formatPeriod(this.service.period()));

  /** One line under the title saying where the sheet stands. */
  protected readonly statusLine = computed(() => {
    const sheet = this.service.timesheet();
    if (!sheet) return '';
    switch (sheet.status) {
      case 'DRAFT':
        return 'Draft — changes save as you type.';
      case 'SUBMITTED':
        return 'Submitted and awaiting approval. Entries are locked.';
      case 'APPROVED':
        return `Approved${sheet.approver ? ` by ${sheet.approver.fullName}` : ''}. Entries are locked.`;
      case 'REJECTED':
        return 'Sent back for changes — edit and resubmit.';
      default:
        return '';
    }
  });

  protected readonly rejectionReason = computed(() =>
    this.service.status() === 'REJECTED' ? this.service.timesheet()?.rejectionReason : null
  );

  protected readonly canSubmit = computed(
    () => this.service.canEdit() && this.service.totals().totalHours > 0 && !this.service.isSaving()
  );

  protected readonly blankWeekdayCount = computed(() => this.blankWeekdays().length);

  /**
   * The URL is the source of truth for which period is open, so a deep link,
   * the back button, or navigating straight from one month to another all
   * land on the right sheet. Angular reuses this component when only the
   * parameter changes, so this tracks the observable rather than the
   * one-shot route snapshot.
   */
  private readonly routePeriod = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('period')))
  );

  constructor() {
    effect(() => {
      const period = this.routePeriod();
      if (period) this.service.period.set(period);
    });
  }

  protected rowClass(row: GridRow): string {
    const status = row.entry.status;
    if (status === 'LEAVE') return 'bg-amber-50 dark:bg-amber-950/20';
    if (status === 'HOLIDAY') return 'bg-sky-50 dark:bg-sky-950/20';
    if (status === 'WEEKEND_WORK') return 'bg-purple-50/60 dark:bg-purple-950/20';
    return row.isWeekend ? 'bg-gray-50 dark:bg-gray-800/40' : '';
  }

  /** Empty input clears the cell rather than writing 0. */
  protected toHours(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  protected patch(
    entry: TimesheetEntry,
    patch: {
      startTime?: string | null;
      endTime?: string | null;
      hours?: number | null;
      status?: EntryStatus;
      notes?: string | null;
    }
  ): void {
    this.service.updateEntry(entry.id, patch);
  }

  protected submit(): void {
    void this.service.submitForApproval();
  }

  protected async openExport(format: 'json' | 'csv' | 'html'): Promise<void> {
    if (this.isExporting()) return;

    // Open synchronously while the click still has browser user activation.
    // Navigating it after the authenticated request avoids popup blockers.
    const preview = format === 'html' ? window.open('', '_blank') : null;
    if (preview) preview.opener = null;

    this.isExporting.set(true);
    try {
      const file = await this.service.exportFile(format);
      if (!file) {
        preview?.close();
        return;
      }

      const url = URL.createObjectURL(file.blob);
      if (preview) {
        preview.location.replace(url);
        // Keep the object URL alive long enough for the new tab to finish loading.
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }

      // If a preview window was blocked, downloading the HTML still gives the
      // user the complete export instead of making the button appear inert.
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } finally {
      this.isExporting.set(false);
    }
  }

  protected backToList(): void {
    void this.router.navigate(['/timesheets']);
  }

  protected applyAutoFill(): void {
    const patches: BulkEntryPatch[] = this.blankWeekdays().map((entry) => ({
      date: entry.entryDate.slice(0, 10),
      startTime: this.fillStart(),
      endTime: this.fillEnd(),
      hours: this.fillHours(),
      status: 'WORKING' as EntryStatus,
    }));
    this.autoFillOpen.set(false);
    void this.service.bulkUpsert(patches);
  }

  /** Weekdays still untouched — auto-fill never overwrites real entries. */
  private blankWeekdays(): TimesheetEntry[] {
    return this.service
      .entries()
      .filter(
        (entry) =>
          entry.dayOfWeek !== 'Saturday' &&
          entry.dayOfWeek !== 'Sunday' &&
          entry.status === 'EMPTY' &&
          (entry.hours === null || entry.hours === 0)
      );
  }
}
