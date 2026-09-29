import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ApiDataService } from '@core/http/api-data.service';
import {
  ApiEnvelope,
  BulkEntryPatch,
  EntryPatch,
  Timesheet,
  TimesheetEntry,
  TimesheetTotals,
  TimesheetYearSummary,
  isEditable,
  isNonWorking,
  periodOf,
} from './timesheet.model';

const AUTOSAVE_DEBOUNCE_MS = 400;

/** Roll entries up into the figures the summary card and totals bar show. */
export const computeTotals = (entries: readonly TimesheetEntry[]): TimesheetTotals =>
  entries.reduce<TimesheetTotals>(
    (acc, entry) => {
      acc.totalHours += entry.hours ?? 0;
      switch (entry.status) {
        case 'WORKING':
          acc.workingDays += 1;
          break;
        case 'EXTENDED':
          acc.workingDays += 1;
          acc.extendedDays += 1;
          break;
        case 'WEEKEND_WORK':
          acc.workingDays += 1;
          acc.weekendWorkDays += 1;
          break;
        case 'LEAVE':
          acc.leaveDays += 1;
          break;
        case 'HOLIDAY':
          acc.holidayDays += 1;
          break;
        default:
          break;
      }
      return acc;
    },
    {
      totalHours: 0,
      workingDays: 0,
      leaveDays: 0,
      holidayDays: 0,
      extendedDays: 0,
      weekendWorkDays: 0,
    }
  );

/**
 * Apply a patch the way the server will, so an optimistic row matches what
 * comes back. Leave and holiday days carry no hours or clock times.
 */
export const applyPatch = (entry: TimesheetEntry, patch: EntryPatch): TimesheetEntry => {
  const next: TimesheetEntry = { ...entry, ...patch };
  if (isNonWorking(next.status)) {
    next.hours = null;
    next.startTime = null;
    next.endTime = null;
  }
  return next;
};

@Injectable({ providedIn: 'root' })
export class TimesheetService {
  private readonly api = inject(ApiDataService);
  private readonly messages = inject(MessageService);

  /** Which sheet the grid is looking at. Changing either refetches. */
  readonly period = signal(periodOf(new Date()));
  /** Null means "the signed-in user"; the server fills that in. */
  readonly employeeId = signal<string | null>(null);

  readonly timesheetResource = resource<Timesheet | undefined, { employeeId: string | null; period: string }>({
    params: () => ({ employeeId: this.employeeId(), period: this.period() }),
    loader: ({ params }) => this.fetchTimesheet(params.employeeId, params.period),
  });

  readonly timesheet = computed(() => this.timesheetResource.value());
  readonly entries = computed<readonly TimesheetEntry[]>(
    () => this.timesheetResource.value()?.entries ?? []
  );
  readonly totals = computed(() => computeTotals(this.entries()));
  readonly isLoading = computed(() => this.timesheetResource.isLoading());
  readonly loadError = computed(() => this.timesheetResource.error());
  readonly status = computed(() => this.timesheet()?.status ?? 'DRAFT');
  readonly canEdit = computed(() => isEditable(this.status()));

  /** True while at least one debounced autosave is still in flight. */
  readonly isSaving = computed(() => this.pendingSaves() > 0);
  private readonly pendingSaves = signal(0);

  /** Per-entry debounce timers, and the row to restore if a save fails. */
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly rollbacks = new Map<string, TimesheetEntry>();

  private fetchTimesheet(employeeId: string | null, period: string): Promise<Timesheet> {
    const params: Record<string, string> = { period };
    if (employeeId) params['employeeId'] = employeeId;
    return firstValueFrom(
      this.api.getData<ApiEnvelope<Timesheet>>('/timesheets', params)
    ).then((response) => response.data);
  }

  /**
   * Optimistically patch the row, then persist after a short pause so that
   * typing into a cell does not fire a request per keystroke. A failed save
   * restores the row as it was before the burst of edits began.
   */
  updateEntry(entryId: string, patch: EntryPatch): void {
    const sheet = this.timesheetResource.value();
    const current = sheet?.entries.find((entry) => entry.id === entryId);
    if (!sheet || !current) return;

    if (!this.rollbacks.has(entryId)) this.rollbacks.set(entryId, current);
    this.writeEntry(applyPatch(current, patch));

    const existingTimer = this.timers.get(entryId);
    if (existingTimer) clearTimeout(existingTimer);

    this.timers.set(
      entryId,
      setTimeout(() => {
        this.timers.delete(entryId);
        void this.flushEntry(sheet.id, entryId);
      }, AUTOSAVE_DEBOUNCE_MS)
    );
  }

  private async flushEntry(timesheetId: string, entryId: string): Promise<void> {
    const entry = this.timesheetResource.value()?.entries.find((e) => e.id === entryId);
    if (!entry) return;

    const snapshot = this.rollbacks.get(entryId);
    this.pendingSaves.update((count) => count + 1);

    try {
      const response = await firstValueFrom(
        this.api.patchData<ApiEnvelope<Timesheet>>(
          `/timesheets/${timesheetId}/entries/${entryId}`,
          {
            startTime: entry.startTime,
            endTime: entry.endTime,
            hours: entry.hours,
            status: entry.status,
            notes: entry.notes,
          }
        )
      );
      this.rollbacks.delete(entryId);
      this.timesheetResource.set(response.data);
    } catch (error) {
      if (snapshot) this.writeEntry(snapshot);
      this.rollbacks.delete(entryId);
      this.showError('Could not save that change', error);
    } finally {
      this.pendingSaves.update((count) => count - 1);
    }
  }

  /**
   * Write several rows in one request — used by "auto-fill weekdays". The
   * server returns the whole sheet, so totals stay in step with the rows.
   */
  async bulkUpsert(patches: readonly BulkEntryPatch[]): Promise<void> {
    const sheet = this.timesheetResource.value();
    if (!sheet || patches.length === 0) return;

    const snapshot = sheet;
    const byDate = new Map(patches.map((patch) => [patch.date, patch]));
    this.timesheetResource.set({
      ...sheet,
      entries: sheet.entries.map((entry) => {
        const patch = byDate.get(entry.entryDate.slice(0, 10));
        return patch ? applyPatch(entry, patch) : entry;
      }),
    });

    this.pendingSaves.update((count) => count + 1);
    try {
      const response = await firstValueFrom(
        this.api.postData<ApiEnvelope<Timesheet>>(`/timesheets/${sheet.id}/entries/bulk`, {
          entries: patches,
        })
      );
      this.timesheetResource.set(response.data);
    } catch (error) {
      this.timesheetResource.set(snapshot);
      this.showError('Could not apply those changes', error);
    } finally {
      this.pendingSaves.update((count) => count - 1);
    }
  }

  submitForApproval(): Promise<void> {
    return this.transition('submit', {}, 'Timesheet submitted for approval');
  }

  approve(): Promise<void> {
    return this.transition('approve', {}, 'Timesheet approved');
  }

  reject(rejectionReason: string): Promise<void> {
    return this.transition('reject', { rejectionReason }, 'Timesheet sent back to the employee');
  }

  async loadYearSummary(year: number, employeeId?: string): Promise<TimesheetYearSummary | null> {
    const params: Record<string, string> = { year: String(year) };
    if (employeeId) params['employeeId'] = employeeId;
    try {
      const response = await firstValueFrom(
        this.api.getData<ApiEnvelope<TimesheetYearSummary>>('/timesheets/summary', params)
      );
      return response.data;
    } catch (error) {
      this.showError('Could not load the yearly summary', error);
      return null;
    }
  }

  /** Absolute URL for an export, opened in a new tab by the toolbar. */
  exportUrl(format: 'json' | 'csv' | 'html'): string | null {
    const sheet = this.timesheet();
    return sheet ? `/api/v1/timesheets/${sheet.id}/export?format=${format}` : null;
  }

  private async transition(
    action: 'submit' | 'approve' | 'reject',
    body: Record<string, unknown>,
    successDetail: string
  ): Promise<void> {
    const sheet = this.timesheetResource.value();
    if (!sheet) return;

    try {
      const response = await firstValueFrom(
        this.api.postData<ApiEnvelope<Timesheet>>(`/timesheets/${sheet.id}/${action}`, body)
      );
      this.timesheetResource.set(response.data);
      this.messages.add({ severity: 'success', summary: 'Done', detail: successDetail });
    } catch (error) {
      this.showError(`Could not ${action} the timesheet`, error);
    }
  }

  private writeEntry(entry: TimesheetEntry): void {
    this.timesheetResource.update((sheet) =>
      sheet
        ? { ...sheet, entries: sheet.entries.map((e) => (e.id === entry.id ? entry : e)) }
        : sheet
    );
  }

  private showError(summary: string, error: unknown): void {
    const detail =
      (error as { error?: { message?: string } })?.error?.message ??
      (error as Error)?.message ??
      'Please try again.';
    this.messages.add({ severity: 'error', summary, detail });
  }
}
