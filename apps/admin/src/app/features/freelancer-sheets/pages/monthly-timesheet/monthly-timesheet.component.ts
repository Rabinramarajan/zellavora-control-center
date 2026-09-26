import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SheetsApi } from '../../sheets.api';
import { MonthlyDocument, SheetRequestError } from '../../sheets.models';
import { statusLabel } from '../../sheets.presentation';

const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "Aug 6" → "August 6", as the schedule notes spell it out. */
const longDate = (label: string, month: number): string =>
  label.replace(/^\w+/, LONG_MONTHS[month - 1]);

/** 10 → "10", 7.5 → "7.5": whole hours print without decimals, as on the form. */
const formatHours = (hours: number): string =>
  Number.isInteger(hours) ? String(hours) : String(Math.round(hours * 100) / 100);

/**
 * The monthly timesheet in the signed paper layout: header bar, one row per
 * calendar day, summary, work-schedule notes and signature blocks.
 *
 *   /freelancer-sheets/monthly/timesheet?month=8&year=2026[&userId=…]
 *
 * "Print / Save as PDF" uses the browser's print dialog; the print styles
 * hide the app around the sheet so the output is the document alone.
 */
@Component({
  selector: 'app-monthly-timesheet',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './monthly-timesheet.component.html',
  styleUrls: ['./monthly-timesheet.component.css'],
  // Print rules must reach <body> to hide the app shell, so styles are not
  // encapsulated; every selector is namespaced under .ts-page / .ts-doc.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthlyTimesheetComponent implements OnInit {
  private readonly api = inject(SheetsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly document = signal<MonthlyDocument | null>(null);

  private readonly userId = this.route.snapshot.queryParamMap.get('userId') ?? undefined;
  protected readonly month = signal(this.initialMonth());

  protected readonly monthLabel = computed(() =>
    this.month().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );

  protected readonly scheduleNotes = computed(() => {
    const doc = this.document();
    if (!doc) return [];
    const { summary, schedule, month } = doc;
    const list = (labels: string[]): string =>
      labels.length ? labels.map((label) => longDate(label, month)).join(', ') : 'None';

    const notes = [
      schedule
        ? `Regular Hours: ${schedule.startTime} - ${schedule.endTime} (${formatHours(schedule.hours)} hours/day)`
        : 'Regular Hours: Not established',
      `Extended/Overtime days: ${list(summary.extendedDates)}`,
      `Weekend Work: ${list(summary.weekendWorkDates)}`,
      `Leave Days: ${list(summary.leaveDates)}`,
    ];
    if (summary.holidayDays) notes.push(`Holidays: ${list(summary.holidayDates)}`);
    return notes;
  });

  protected readonly statusText = computed(() => {
    const doc = this.document();
    if (!doc) return '';
    return doc.status === 'preview' ? 'Preview' : statusLabel(doc.status);
  });

  protected readonly formatHours = formatHours;

  public ngOnInit(): void {
    void this.load();
  }

  protected shiftMonth(months: number): void {
    const next = new Date(this.month());
    next.setMonth(next.getMonth() + months);
    this.month.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { month: next.getMonth() + 1, year: next.getFullYear() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    void this.load();
  }

  protected print(): void {
    window.print();
  }

  protected reload(): void {
    void this.load();
  }

  /** Signature-block dates are only filled once the event has happened. */
  protected signedOn(iso: string | null): string | null {
    return iso
      ? new Date(iso).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null;
  }

  private async load(): Promise<void> {
    const month = this.month();
    this.loading.set(true);
    this.error.set(null);
    try {
      this.document.set(
        await this.api.monthlyDocument(month.getMonth() + 1, month.getFullYear(), this.userId)
      );
    } catch (error) {
      this.document.set(null);
      this.error.set((error as SheetRequestError).message);
    } finally {
      this.loading.set(false);
    }
  }

  private initialMonth(): Date {
    const params = this.route.snapshot.queryParamMap;
    const month = Number(params.get('month'));
    const year = Number(params.get('year'));
    const now = new Date();
    return month >= 1 && month <= 12 && year >= 2000 && year <= 2100
      ? new Date(year, month - 1, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
  }
}
