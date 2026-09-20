import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
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
  template: `
    <p-toast />

    <div class="space-y-6 p-6">
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            class="text-sm text-purple-600 hover:underline dark:text-purple-400"
            (click)="backToList()"
          >
            &larr; All periods
          </button>
          <h1 class="mt-1 text-2xl font-bold sm:text-3xl">{{ periodLabel() }}</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ statusLine() }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          @if (service.isSaving()) {
            <span class="text-sm text-gray-500">Saving…</span>
          }
          <p-button
            label="Auto-fill weekdays"
            severity="secondary"
            [outlined]="true"
            [disabled]="!service.canEdit() || service.isLoading()"
            (onClick)="autoFillOpen.set(true)"
          />
          <p-button
            label="Export"
            severity="secondary"
            [outlined]="true"
            [disabled]="!service.timesheet()"
            (onClick)="openExport('html')"
          />
          <p-button
            label="Submit for approval"
            [disabled]="!canSubmit()"
            (onClick)="submit()"
          />
        </div>
      </header>

      @if (rejectionReason(); as reason) {
        <div
          class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          <strong class="font-semibold">Sent back for changes:</strong> {{ reason }}
        </div>
      }

      <app-timesheet-summary-card [totals]="service.totals()" />

      @if (service.isLoading()) {
        <p class="py-12 text-center text-gray-500">Loading timesheet…</p>
      } @else if (service.loadError()) {
        <div class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <p class="text-sm text-red-800 dark:text-red-300">
            This timesheet could not be loaded.
          </p>
          <p-button
            class="mt-3 inline-block"
            label="Retry"
            size="small"
            (onClick)="service.timesheetResource.reload()"
          />
        </div>
      } @else {
        <div
          class="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
        >
          <table class="w-full min-w-[56rem] text-sm">
            <caption class="sr-only">
              Daily entries for {{ periodLabel() }}
            </caption>
            <thead class="bg-gray-50 text-left dark:bg-gray-800/60">
              <tr>
                <th scope="col" class="px-3 py-2 font-semibold">Date</th>
                <th scope="col" class="px-3 py-2 font-semibold">Day</th>
                <th scope="col" class="px-3 py-2 font-semibold">Start</th>
                <th scope="col" class="px-3 py-2 font-semibold">End</th>
                <th scope="col" class="px-3 py-2 text-right font-semibold">Hours</th>
                <th scope="col" class="px-3 py-2 font-semibold">Status</th>
                <th scope="col" class="px-3 py-2 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.entry.id) {
                <tr
                  class="border-t border-gray-100 dark:border-gray-800"
                  [class]="rowClass(row)"
                >
                  <td class="px-3 py-1.5 tabular-nums">
                    {{ row.entry.entryDate | date: 'd MMM' : 'UTC' }}
                  </td>
                  <td class="px-3 py-1.5 text-gray-600 dark:text-gray-400">
                    {{ row.entry.dayOfWeek }}
                  </td>
                  <td class="px-3 py-1.5">
                    <input
                      pInputText
                      type="text"
                      class="w-24"
                      inputmode="numeric"
                      placeholder="09:00"
                      [attr.aria-label]="'Start time on ' + row.entry.dayOfWeek"
                      [disabled]="!service.canEdit() || row.isNonWorking"
                      [ngModel]="row.entry.startTime"
                      (ngModelChange)="patch(row.entry, { startTime: $event || null })"
                    />
                  </td>
                  <td class="px-3 py-1.5">
                    <input
                      pInputText
                      type="text"
                      class="w-24"
                      inputmode="numeric"
                      placeholder="17:30"
                      [attr.aria-label]="'End time on ' + row.entry.dayOfWeek"
                      [disabled]="!service.canEdit() || row.isNonWorking"
                      [ngModel]="row.entry.endTime"
                      (ngModelChange)="patch(row.entry, { endTime: $event || null })"
                    />
                  </td>
                  <td class="px-3 py-1.5 text-right">
                    <input
                      pInputText
                      type="number"
                      class="w-20 text-right"
                      min="0"
                      max="24"
                      step="0.25"
                      [attr.aria-label]="'Hours on ' + row.entry.dayOfWeek"
                      [disabled]="!service.canEdit() || row.isNonWorking"
                      [ngModel]="row.entry.hours"
                      (ngModelChange)="patch(row.entry, { hours: toHours($event) })"
                    />
                  </td>
                  <td class="px-3 py-1.5">
                    @if (service.canEdit()) {
                      <p-select
                        [options]="statusOptions"
                        optionLabel="label"
                        optionValue="value"
                        appendTo="body"
                        [ariaLabel]="'Status on ' + row.entry.dayOfWeek"
                        [ngModel]="row.entry.status"
                        (ngModelChange)="patch(row.entry, { status: $event })"
                      />
                    } @else {
                      <span
                        class="inline-block rounded px-2 py-0.5 text-xs font-medium"
                        [class]="row.entry.status | dayStatus: 'badgeClass'"
                      >
                        {{ row.entry.status | dayStatus: 'label' }}
                      </span>
                    }
                  </td>
                  <td class="px-3 py-1.5">
                    <input
                      pInputText
                      type="text"
                      class="w-full min-w-[12rem]"
                      [attr.aria-label]="'Notes for ' + row.entry.dayOfWeek"
                      [disabled]="!service.canEdit()"
                      [ngModel]="row.entry.notes"
                      (ngModelChange)="patch(row.entry, { notes: $event || null })"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Live totals, recomputed from the entries signal on every edit. -->
        <div
          class="sticky bottom-0 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95"
        >
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ service.totals().workingDays }} working days ·
            {{ service.totals().leaveDays }} leave ·
            {{ service.totals().holidayDays }} holidays
          </span>
          <span class="text-lg font-semibold tabular-nums">
            {{ service.totals().totalHours.toFixed(2) }} hours
          </span>
        </div>

        <app-timesheet-approval-panel />
      }
    </div>

    <p-dialog
      header="Auto-fill weekdays"
      [modal]="true"
      [style]="{ width: '24rem' }"
      [(visible)]="autoFillOpenModel"
    >
      <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Applies to every weekday that has no hours yet. Days already filled in are left alone.
      </p>
      <div class="space-y-3">
        <label class="block text-sm font-medium" for="fill-start">Start</label>
        <input pInputText id="fill-start" class="w-full" [(ngModel)]="fillStart" />

        <label class="block text-sm font-medium" for="fill-end">End</label>
        <input pInputText id="fill-end" class="w-full" [(ngModel)]="fillEnd" />

        <label class="block text-sm font-medium" for="fill-hours">Hours</label>
        <input
          pInputText
          id="fill-hours"
          type="number"
          min="0"
          max="24"
          step="0.25"
          class="w-full"
          [(ngModel)]="fillHours"
        />
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" severity="secondary" [text]="true" (onClick)="autoFillOpen.set(false)" />
        <p-button label="Apply" [disabled]="blankWeekdayCount() === 0" (onClick)="applyAutoFill()" />
      </ng-template>
    </p-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesheetGridComponent {
  protected readonly service = inject(TimesheetService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // p-select takes a mutable array, so the shared readonly list is copied.
  protected readonly statusOptions = [...ENTRY_STATUS_OPTIONS];

  protected readonly autoFillOpen = signal(false);
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
    patch: { startTime?: string | null; endTime?: string | null; hours?: number | null; status?: EntryStatus; notes?: string | null }
  ): void {
    this.service.updateEntry(entry.id, patch);
  }

  protected submit(): void {
    void this.service.submitForApproval();
  }

  protected openExport(format: 'json' | 'csv' | 'html'): void {
    const url = this.service.exportUrl(format);
    if (url) window.open(url, '_blank', 'noopener');
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
