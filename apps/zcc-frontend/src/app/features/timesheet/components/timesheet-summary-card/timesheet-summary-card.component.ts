import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TimesheetTotals } from '../../data/timesheet.model';

/** The four headline figures for a period, derived entirely from `totals`. */
@Component({
  selector: 'app-timesheet-summary-card',
  standalone: true,
  templateUrl: './timesheet-summary-card.component.html',
  styleUrl: './timesheet-summary-card.component.scss',
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
