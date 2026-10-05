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
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { TimesheetService } from '../../data/timesheet.service';
import {
  IMPORT_ACCEPT,
  TimesheetImportFile,
  readTimesheetImport,
} from '../../data/timesheet-import';
import {
  BulkEntryPatch,
  EntryStatus,
  TimesheetEntry,
  formatPeriod,
} from '../../data/timesheet.model';
import {
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  RowClassFn,
} from '../../../../shared/components/data-table';
import { TimePickerComponent } from '../../../../shared/components/time-picker/time-picker.component';
import {
  hoursBetween,
  parseTime,
} from '../../../../shared/components/time-picker/time-picker.utils';
import { buildTimesheetReport } from '../../data/timesheet-report';
import { TimesheetReportPreviewComponent } from '../timesheet-report-preview/timesheet-report-preview.component';
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
    DialogModule,
    ToastModule,
    DayStatusPipe,
    TimePickerComponent,
    DataTableComponent,
    DataTableCellDirective,
    TimesheetReportPreviewComponent,
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
  protected readonly importOpen = signal(false);
  protected readonly previewOpen = signal(false);

  /** Rebuilt from the live sheet, so the preview follows edits saved meanwhile. */
  protected readonly report = computed(() => {
    const sheet = this.service.timesheet();
    return sheet ? buildTimesheetReport(sheet) : null;
  });
  protected readonly isReadingImport = signal(false);
  protected readonly isImporting = signal(false);
  protected readonly importAccept = IMPORT_ACCEPT;
  protected readonly importFilename = signal('');
  protected readonly importPreview = signal<TimesheetImportFile | null>(null);
  protected readonly canApplyImport = computed(() => {
    const preview = this.importPreview();
    return (
      !!preview?.format &&
      preview.errors.length === 0 &&
      preview.entries.length > 0 &&
      this.service.canEdit() &&
      !this.isReadingImport() &&
      !this.isImporting()
    );
  });
  protected readonly fillStart = signal('9:00 AM');
  protected readonly fillEnd = signal('5:30 PM');
  protected readonly fillHours = signal(8);

  /** Two-way binding target for p-dialog's `visible`. */
  protected get autoFillOpenModel(): boolean {
    return this.autoFillOpen();
  }
  protected set autoFillOpenModel(value: boolean) {
    this.autoFillOpen.set(value);
  }

  protected get previewOpenModel(): boolean {
    return this.previewOpen();
  }
  protected set previewOpenModel(value: boolean) {
    this.previewOpen.set(value);
  }

  protected get importOpenModel(): boolean {
    return this.importOpen();
  }
  protected set importOpenModel(value: boolean) {
    this.importOpen.set(value);
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

  /** Every cell is a template; the definitions give headers, widths and CSV values. */
  protected readonly columns: readonly DataTableColumn<GridRow>[] = [
    {
      id: 'date',
      label: 'Date',
      width: '6.5rem',
      value: (row) => row.entry.entryDate.slice(0, 10),
    },
    { id: 'day', label: 'Day', width: '8rem', value: (row) => row.entry.dayOfWeek },
    { id: 'start', label: 'Start Time', width: '10rem', value: (row) => row.entry.startTime },
    { id: 'end', label: 'End Time', width: '10rem', value: (row) => row.entry.endTime },
    { id: 'hours', label: 'Hours', width: '6.5rem', value: (row) => row.entry.hours },
    {
      id: 'statusNotes',
      label: 'Status/Notes',
      value: (row) => [row.entry.status, row.entry.notes].filter(Boolean).join(' — '),
    },
  ];

  protected readonly rowId = (row: GridRow): string => row.entry.id;
  protected readonly rowLabel = (row: GridRow): string => row.entry.entryDate.slice(0, 10);

  /** Shading keys styled in this component's stylesheet. */
  protected readonly rowClasses: RowClassFn<GridRow> = (row) => ({
    'ts-row-leave': row.entry.status === 'LEAVE',
    'ts-row-holiday': row.entry.status === 'HOLIDAY',
    'ts-row-weekend-work': row.entry.status === 'WEEKEND_WORK',
    'ts-row-weekend': row.isWeekend && !row.isNonWorking && row.entry.status !== 'WEEKEND_WORK',
  });

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

  /**
   * Set a clock time. Once both ends are known and no hours were entered,
   * the hours are filled in from the span so the common case needs one less edit.
   */
  protected setTime(
    entry: TimesheetEntry,
    field: 'startTime' | 'endTime',
    value: string | null
  ): void {
    const next = { ...entry, [field]: value };
    const start = parseTime(next.startTime);
    const end = parseTime(next.endTime);
    const fillHours = start !== null && end !== null && (entry.hours === null || entry.hours === 0);
    this.patch(entry, {
      [field]: value,
      ...(fillHours && { hours: hoursBetween(start, end) }),
      ...(fillHours && entry.status === 'EMPTY' && { status: this.workedStatus(entry) }),
    });
  }

  private workedStatus(entry: TimesheetEntry): EntryStatus {
    return entry.dayOfWeek === 'Saturday' || entry.dayOfWeek === 'Sunday'
      ? 'WEEKEND_WORK'
      : 'WORKING';
  }

  protected submit(): void {
    void this.service.submitForApproval();
  }

  /** CSV comes from the API so it stays importable; PDF and Word are built in the preview. */
  protected async downloadCsv(): Promise<void> {
    if (this.isExporting()) return;
    this.isExporting.set(true);
    try {
      const file = await this.service.exportFile('csv');
      if (!file) return;
      const url = URL.createObjectURL(file.blob);
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

  protected openImport(): void {
    this.importFilename.set('');
    this.importPreview.set(null);
    this.importOpen.set(true);
  }

  protected async selectImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    // Clear the input so choosing the same file again, after fixing it, still fires `change`.
    input.value = '';
    this.importFilename.set(file?.name ?? '');
    this.importPreview.set(null);
    if (!file) return;

    this.isReadingImport.set(true);
    try {
      this.importPreview.set(await readTimesheetImport(file, this.service.period()));
    } finally {
      this.isReadingImport.set(false);
    }
  }

  protected async applyImport(): Promise<void> {
    const preview = this.importPreview();
    if (!this.canApplyImport() || !preview?.format) return;

    this.isImporting.set(true);
    try {
      const result = await this.service.importFile(
        preview.content,
        preview.format,
        this.importFilename(),
        preview.sourceFormat ?? preview.format
      );
      if (result.ok) {
        this.importOpen.set(false);
        this.importPreview.set(null);
      } else {
        // The server is the authority; show its reasons in place of the local preview.
        this.importPreview.set({ ...preview, entries: [], errors: result.errors });
      }
    } finally {
      this.isImporting.set(false);
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
