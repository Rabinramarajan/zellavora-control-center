import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectControl, SelectControlOption } from '@zellavoras/ui';
import { ToastModule } from 'primeng/toast';
import { TimesheetService } from '../../data/timesheet.service';
import {
  TimesheetPeriodSummary,
  TimesheetStatus,
  formatPeriod,
  periodOf,
} from '../../data/timesheet.model';

const STATUS_BADGES: Record<TimesheetStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  SUBMITTED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

/**
 * The periods landing page: pick a year to see what has been filed, or pick
 * a month to open its grid. Opening a month that has no sheet yet creates
 * the draft server-side, so there is no separate "create" step.
 */
@Component({
  selector: 'app-timesheet-list',
  standalone: true,
  imports: [ButtonModule, SelectControl, ToastModule],
  template: `
    <p-toast />

    <div class="space-y-6 p-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold sm:text-3xl">Timesheets</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            One sheet per month. Open a month to fill it in or review it.
          </p>
        </div>

        <div class="flex flex-wrap items-end gap-2">
          <app-select-control
            class="w-32"
            label="Year"
            [options]="yearOptions"
            [value]="'' + year()"
            (valueChange)="selectYear(+$event)"
          />
          <app-select-control
            class="w-44"
            label="Month"
            [options]="monthOptions"
            [value]="'' + month()"
            (valueChange)="month.set(+$event)"
          />
          <p-button label="Open" (onClick)="openSelected()" />
        </div>
      </header>

      @if (loading()) {
        <p class="py-12 text-center text-gray-500">Loading periods…</p>
      } @else if (rows().length === 0) {
        <div
          class="rounded-lg border border-dashed border-gray-300 p-12 text-center dark:border-gray-700"
        >
          <p class="text-gray-600 dark:text-gray-400">No timesheets filed for {{ year() }} yet.</p>
          <p-button class="mt-4 inline-block" label="Start this month" (onClick)="openCurrent()" />
        </div>
      } @else {
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          @for (row of rows(); track row.period) {
            <button
              type="button"
              class="rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-purple-400 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-purple-500"
              (click)="open(row.period)"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="font-semibold">{{ label(row.period) }}</span>
                <span
                  class="rounded px-2 py-0.5 text-xs font-medium"
                  [class]="badgeClass(row.status)"
                >
                  {{ row.status }}
                </span>
              </div>
              <div class="mt-3 text-2xl font-bold tabular-nums">
                {{ row.totalHours.toFixed(2) }}<span class="text-base font-normal"> h</span>
              </div>
              <p class="mt-1 text-xs text-gray-500">
                {{ row.workingDays }} working days · {{ row.leaveDays }} leave
              </p>
            </button>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesheetListComponent {
  private readonly service = inject(TimesheetService);
  private readonly router = inject(Router);

  private readonly currentYear = new Date().getFullYear();

  protected readonly yearOptions: SelectControlOption[] = Array.from({ length: 5 }, (_, i) => {
    const year = String(this.currentYear - i);
    return { value: year, label: year };
  });

  protected readonly monthOptions: SelectControlOption[] = Array.from({ length: 12 }, (_, i) => ({
    label: new Date(Date.UTC(2000, i, 1)).toLocaleDateString('en-US', {
      month: 'long',
      timeZone: 'UTC',
    }),
    value: String(i + 1),
  }));

  protected readonly year = signal(this.currentYear);
  protected readonly month = signal(new Date().getMonth() + 1);
  protected readonly loading = signal(true);
  protected readonly rows = signal<readonly TimesheetPeriodSummary[]>([]);

  protected readonly selectedPeriod = computed(
    () => `${this.year()}-${String(this.month()).padStart(2, '0')}`
  );

  constructor() {
    void this.load(this.currentYear);
  }

  protected label(period: string): string {
    return formatPeriod(period);
  }

  protected badgeClass(status: TimesheetStatus): string {
    return STATUS_BADGES[status];
  }

  protected selectYear(year: number): void {
    this.year.set(year);
    void this.load(year);
  }

  protected open(period: string): void {
    void this.router.navigate(['/timesheets', period]);
  }

  protected openSelected(): void {
    this.open(this.selectedPeriod());
  }

  protected openCurrent(): void {
    this.open(periodOf(new Date()));
  }

  private async load(year: number): Promise<void> {
    this.loading.set(true);
    const summary = await this.service.loadYearSummary(year);
    this.rows.set(summary?.periods ?? []);
    this.loading.set(false);
  }
}
