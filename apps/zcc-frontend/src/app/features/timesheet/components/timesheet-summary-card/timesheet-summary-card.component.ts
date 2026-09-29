import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TimesheetTotals } from '../../data/timesheet.model';

/** The four headline figures for a period, derived entirely from `totals`. */
@Component({
  selector: 'app-timesheet-summary-card',
  standalone: true,
  template: `
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      @for (metric of metrics(); track metric.label) {
        <div
          class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="text-sm font-medium text-gray-600 dark:text-gray-400">
            {{ metric.label }}
          </div>
          <div class="mt-1 text-2xl font-bold tabular-nums">{{ metric.value }}</div>
          <p class="mt-1 text-xs text-gray-500">{{ metric.hint }}</p>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesheetSummaryCardComponent {
  readonly totals = input.required<TimesheetTotals>();

  protected readonly metrics = computed(() => {
    const totals = this.totals();
    return [
      {
        label: 'Working days',
        value: String(totals.workingDays),
        hint: 'Days with logged work',
      },
      {
        label: 'Leave days',
        value: String(totals.leaveDays),
        hint: 'Approved leave in this period',
      },
      {
        label: 'Weekend / extended',
        value: String(totals.weekendWorkDays + totals.extendedDays),
        hint: 'Days worked beyond the normal pattern',
      },
      {
        label: 'Total hours',
        value: totals.totalHours.toFixed(2),
        hint: 'Sum of all logged hours',
      },
    ];
  });
}
