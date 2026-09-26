import { Injectable, computed, inject, signal } from '@angular/core';
import { ErrorBus } from '../../core/error/error-bus';
import { SheetsApi } from './sheets.api';
import {
  DailySheet,
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
      'Submitted for approval'
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
      'Monthly sheet submitted for approval'
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
    successMessage: string
  ): Promise<T> {
    try {
      const result = await call();
      apply(result);
      this.bus.push({ kind: 'info', message: successMessage, ttl: 3000 });
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
