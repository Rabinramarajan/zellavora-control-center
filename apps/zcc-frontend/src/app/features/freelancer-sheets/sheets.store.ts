import { Injectable, computed, inject, signal } from '@angular/core';
import { ErrorBus } from '../../core/error/error-bus';
import { SheetsApi } from './sheets.api';
import {
  DailySheet,
  DailyImportResult,
  DailySheetInput,
  DailySheetQuery,
  MonthlySheet,
  MonthlySheetQuery,
  SheetRequestError,
} from './sheets.models';

/**
 * Page state for the daily, monthly and approval pages.
 *
 * Mutations resolve with the saved sheet or reject with a `SheetRequestError`
 * so the calling page can close a form or map field errors; the store also
 * raises the toast, so pages do not repeat it.
 *
 * Provided per page rather than in root: the approval queue lists the team
 * while the daily page lists only the caller, and neither should briefly
 * render the other's rows.
 */
@Injectable()
export class SheetsStore {
  private readonly api = inject(SheetsApi);
  private readonly bus = inject(ErrorBus);

  private readonly daily = signal<readonly DailySheet[]>([]);
  private readonly monthly = signal<readonly MonthlySheet[]>([]);
  private readonly dailyLoadingState = signal(false);
  private readonly monthlyLoadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  /** Only the latest load may write, so a slow earlier response cannot win. */
  private dailyRequest = 0;
  private monthlyRequest = 0;

  public readonly dailySheets = this.daily.asReadonly();
  public readonly monthlySheets = this.monthly.asReadonly();
  public readonly isDailyLoading = this.dailyLoadingState.asReadonly();
  public readonly isMonthlyLoading = this.monthlyLoadingState.asReadonly();
  public readonly isLoading = computed(
    () => this.dailyLoadingState() || this.monthlyLoadingState()
  );
  public readonly error = this.errorState.asReadonly();

  public async loadDailySheets(query: DailySheetQuery): Promise<void> {
    const request = ++this.dailyRequest;
    this.dailyLoadingState.set(true);
    this.errorState.set(null);
    try {
      const page = await this.api.listDaily({ pageSize: 500, ...query });
      if (request === this.dailyRequest) this.daily.set(page.data);
    } catch (error) {
      if (request === this.dailyRequest) {
        this.errorState.set(`Could not load daily sheets: ${(error as SheetRequestError).message}`);
      }
    } finally {
      if (request === this.dailyRequest) this.dailyLoadingState.set(false);
    }
  }

  public async loadMonthlySheets(query: MonthlySheetQuery): Promise<void> {
    const request = ++this.monthlyRequest;
    this.monthlyLoadingState.set(true);
    this.errorState.set(null);
    try {
      const page = await this.api.listMonthly(query);
      if (request === this.monthlyRequest) this.monthly.set(page.data);
    } catch (error) {
      if (request === this.monthlyRequest) {
        this.errorState.set(
          `Could not load monthly sheets: ${(error as SheetRequestError).message}`
        );
      }
    } finally {
      if (request === this.monthlyRequest) this.monthlyLoadingState.set(false);
    }
  }

  public clearError(): void {
    this.errorState.set(null);
  }

  // ---- daily ------------------------------------------------------------

  public createDailySheet(input: DailySheetInput): Promise<DailySheet> {
    return this.mutate(
      () => this.api.createDaily(input),
      (sheet) => this.upsertDaily(sheet),
      'Daily sheet saved'
    );
  }

  /**
   * Creates sheets one at a time — the API checks each day against the ones
   * already logged, so parallel writes for the same day could race. Failures
   * are collected instead of toasted, and one summary is shown at the end.
   */
  public async importDailySheets(
    inputs: readonly DailySheetInput[],
    onProgress?: (done: number) => void
  ): Promise<DailyImportResult[]> {
    const results: DailyImportResult[] = [];
    for (const input of inputs) {
      try {
        this.upsertDaily(await this.api.createDaily(input));
        results.push({ date: input.sheetDate, ok: true });
      } catch (error) {
        const message = (error as Partial<SheetRequestError>).message || 'Could not be saved';
        results.push({ date: input.sheetDate, ok: false, message });
      }
      onProgress?.(results.length);
    }
    const saved = results.filter((result) => result.ok).length;
    this.bus.push({
      kind: saved === inputs.length ? 'info' : 'error',
      message: `Imported ${saved} of ${inputs.length} day${inputs.length === 1 ? '' : 's'}`,
      ttl: 4000,
    });
    return results;
  }

  /** Days in the range that already hold a live (non-rejected) sheet of the caller's. */
  public async loggedDates(startDate: string, endDate: string): Promise<Set<string>> {
    const page = await this.api.listDaily({ scope: 'mine', startDate, endDate, pageSize: 500 });
    return new Set(
      page.data.filter((sheet) => sheet.status !== 'rejected').map((sheet) => sheet.sheetDate)
    );
  }

  public updateDailySheet(id: string, input: Partial<DailySheetInput>): Promise<DailySheet> {
    return this.mutate(
      () => this.api.updateDaily(id, input),
      (sheet) => this.upsertDaily(sheet),
      'Daily sheet updated'
    );
  }

  public submitDailySheet(id: string): Promise<DailySheet> {
    return this.mutate(
      () => this.api.submitDaily(id),
      (sheet) => this.upsertDaily(sheet),
      (sheet) => (sheet.status === 'approved' ? 'Sheet finalized' : 'Submitted for approval')
    );
  }

  /** Resolves with how many sheets moved; the page reloads its list afterwards. */
  public submitAllDailySheets(
    startDate: string,
    endDate: string
  ): Promise<{ count: number; status: 'submitted' | 'approved' }> {
    return this.mutate(
      () => this.api.submitAllDaily(startDate, endDate),
      () => undefined,
      ({ count, status }) =>
        count === 0
          ? 'No draft sheets in this range'
          : `${count} sheet${count === 1 ? '' : 's'} ${status === 'approved' ? 'finalized' : 'submitted for approval'}`
    );
  }

  public reopenDailySheet(id: string, reason: string): Promise<DailySheet> {
    return this.mutate(
      () => this.api.reopenDaily(id, reason),
      (sheet) => this.upsertDaily(sheet),
      'Sheet reopened for editing'
    );
  }

  public reviewDailySheet(
    id: string,
    approved: boolean,
    rejectionReason?: string
  ): Promise<DailySheet> {
    return this.mutate(
      () => this.api.reviewDaily(id, approved, rejectionReason),
      (sheet) => this.upsertDaily(sheet),
      approved ? 'Sheet approved' : 'Sheet sent back to the freelancer'
    );
  }

  public deleteDailySheet(id: string): Promise<{ id: string }> {
    return this.mutate(
      () => this.api.deleteDaily(id),
      () => this.daily.update((list) => list.filter((sheet) => sheet.id !== id)),
      'Daily sheet deleted'
    );
  }

  public async reviewDailyBulk(ids: readonly string[], approved: boolean, reason?: string) {
    const result = await this.api.reviewDailyBulk(ids, approved, reason);
    result.sheets.forEach((sheet) => this.upsertDaily(sheet));
    this.bus.push({
      kind: result.errors.length ? 'error' : 'info',
      message: result.errors.length
        ? `${result.sheets.length} reviewed; ${result.errors.length} failed. ${result.errors[0].message}`
        : `${result.sheets.length} sheets ${approved ? 'approved' : 'rejected'}`,
    });
    return result;
  }

  // ---- monthly ----------------------------------------------------------

  public generateMonthlySheet(month: number, year: number): Promise<MonthlySheet> {
    return this.mutate(
      () => this.api.generateMonthly(month, year),
      (sheet) => this.upsertMonthly(sheet),
      'Monthly sheet created'
    );
  }

  public regenerateMonthlySheet(id: string): Promise<MonthlySheet> {
    return this.mutate(
      () => this.api.regenerateMonthly(id),
      (sheet) => this.upsertMonthly(sheet),
      'Monthly sheet refreshed from approved daily sheets'
    );
  }

  public submitMonthlySheet(id: string): Promise<MonthlySheet> {
    return this.mutate(
      () => this.api.submitMonthly(id),
      (sheet) => this.upsertMonthly(sheet),
      (sheet) =>
        sheet.status === 'approved'
          ? 'Monthly sheet finalized'
          : 'Monthly sheet submitted for approval'
    );
  }

  public reopenMonthlySheet(id: string, reason: string): Promise<MonthlySheet> {
    return this.mutate(
      () => this.api.reopenMonthly(id, reason),
      (sheet) => this.upsertMonthly(sheet),
      'Monthly sheet reopened for editing'
    );
  }

  public reviewMonthlySheet(
    id: string,
    approved: boolean,
    rejectionReason?: string
  ): Promise<MonthlySheet> {
    return this.mutate(
      () => this.api.reviewMonthly(id, approved, rejectionReason),
      (sheet) => this.upsertMonthly(sheet),
      approved ? 'Monthly sheet approved' : 'Monthly sheet sent back'
    );
  }

  public markMonthlySheetAsPaid(id: string): Promise<MonthlySheet> {
    return this.mutate(
      () => this.api.markMonthlyPaid(id),
      (sheet) => this.upsertMonthly(sheet),
      'Marked as paid'
    );
  }

  public deleteMonthlySheet(id: string): Promise<{ id: string }> {
    return this.mutate(
      () => this.api.deleteMonthly(id),
      () => this.monthly.update((list) => list.filter((sheet) => sheet.id !== id)),
      'Monthly sheet deleted'
    );
  }

  private async mutate<T>(
    call: () => Promise<T>,
    apply: (result: T) => void,
    successMessage: string | ((result: T) => string)
  ): Promise<T> {
    try {
      const result = await call();
      apply(result);
      const message = typeof successMessage === 'string' ? successMessage : successMessage(result);
      this.bus.push({ kind: 'info', message, ttl: 3000 });
      return result;
    } catch (error) {
      const failure = error as SheetRequestError;
      // 0, 403 and 5xx are already toasted by the global error interceptor.
      if (failure.status >= 400 && failure.status < 500 && failure.status !== 403) {
        this.bus.push({ kind: 'error', message: failure.message });
      }
      throw failure;
    }
  }

  private upsertDaily(sheet: DailySheet): void {
    this.daily.update((list) =>
      list.some((item) => item.id === sheet.id)
        ? list.map((item) => (item.id === sheet.id ? sheet : item))
        : [sheet, ...list]
    );
  }

  private upsertMonthly(sheet: MonthlySheet): void {
    this.monthly.update((list) =>
      list.some((item) => item.id === sheet.id)
        ? list.map((item) => (item.id === sheet.id ? sheet : item))
        : [sheet, ...list]
    );
  }
}
