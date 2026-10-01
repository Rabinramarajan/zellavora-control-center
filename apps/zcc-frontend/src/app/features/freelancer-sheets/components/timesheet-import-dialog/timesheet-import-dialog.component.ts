import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { SheetsStore } from '../../sheets.store';
import { DailyImportResult, DailySheetInput } from '../../sheets.models';
import { rememberRate, rememberedRate } from '../../sheets.preferences';
import { round2 } from '../../sheets.time';
import {
  ImportedDay,
  ParsedTimesheet,
  parseTimesheetLines,
  readPdfLines,
  withTimeout,
} from '../../import/timesheet-pdf';

type Phase = 'reading' | 'error' | 'review' | 'importing' | 'done';

/** A one-page timesheet parses in well under a second; anything past this is stuck. */
const READ_TIMEOUT_MS = 15_000;
/** The duplicate check is a convenience — never hold the preview hostage to a slow API. */
const LOGGED_CHECK_TIMEOUT_MS = 8_000;

/** "21:00" → "9:00 PM" */
const formatClock = (clock: string): string => {
  const [hour, minute] = clock.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
};

/**
 * Previews a timesheet PDF as daily sheets and imports the chosen days as
 * drafts. Days that already hold a sheet start deselected so a re-import of
 * the same file does not double-log.
 */
@Component({
  selector: 'app-timesheet-import-dialog',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, CdkTrapFocus],
  templateUrl: './timesheet-import-dialog.component.html',
  styleUrl: './timesheet-import-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class TimesheetImportDialogComponent implements OnInit {
  private readonly store = inject(SheetsStore);

  public readonly file = input.required<File>();
  /** Emits the earliest imported day (or null) so the page can show and refresh that month. */
  public readonly closed = output<string | null>();
  public readonly chooseAnother = output<void>();

  public readonly phase = signal<Phase>('reading');
  public readonly errorMessage = signal('');
  public readonly sheet = signal<ParsedTimesheet | null>(null);
  public readonly logged = signal<ReadonlySet<string>>(new Set());
  public readonly loggedCheckFailed = signal(false);
  public readonly selected = signal<ReadonlySet<string>>(new Set());
  public readonly rate = signal<number | null>(rememberedRate());
  public readonly projectName = signal('');
  public readonly progress = signal(0);
  public readonly results = signal<readonly DailyImportResult[]>([]);

  public readonly formatClock = formatClock;

  public readonly days = computed(() => this.sheet()?.days ?? []);
  public readonly workDays = computed(() => this.days().filter((day) => day.kind === 'work'));
  public readonly absenceDays = computed(() => this.days().filter((day) => day.kind !== 'work'));
  public readonly totalHours = computed(() =>
    round2(this.workDays().reduce((sum, day) => sum + (day.hours ?? 0), 0))
  );
  public readonly hoursMismatch = computed(() => {
    const declared = this.sheet()?.declaredTotalHours;
    return declared !== null && declared !== undefined && declared !== this.totalHours();
  });
  public readonly alreadyLogged = computed(
    () => this.days().filter((day) => this.logged().has(day.date)).length
  );

  public readonly chosen = computed(() =>
    this.days().filter((day) => this.selected().has(day.date))
  );
  public readonly chosenHours = computed(() =>
    round2(
      this.chosen()
        .filter((day) => day.kind === 'work')
        .reduce((sum, day) => sum + (day.hours ?? 0), 0)
    )
  );
  public readonly chosenAmount = computed(() => round2(this.chosenHours() * (this.rate() ?? 0)));
  public readonly allChosen = computed(
    () => this.days().length > 0 && this.chosen().length === this.days().length
  );
  public readonly needsRate = computed(() => this.chosen().some((day) => day.kind === 'work'));
  public readonly rateInvalid = computed(() => {
    const rate = this.rate();
    return (
      this.needsRate() && (rate === null || !Number.isFinite(rate) || rate < 0 || rate > 100000)
    );
  });
  public readonly canImport = computed(() => this.chosen().length > 0 && !this.rateInvalid());

  public readonly succeeded = computed(() => this.results().filter((result) => result.ok).length);
  /** Earliest saved day, so the page can open the month the sheets landed in. */
  public readonly firstImported = computed(
    () =>
      this.results()
        .filter((result) => result.ok)
        .map((result) => result.date)
        .sort()[0] ?? null
  );
  public readonly failures = computed(() =>
    this.results().filter(
      (result): result is Extract<DailyImportResult, { ok: false }> => !result.ok
    )
  );

  public async ngOnInit(): Promise<void> {
    let sheet: ParsedTimesheet;
    try {
      const lines = await withTimeout(readPdfLines(this.file()), READ_TIMEOUT_MS, 'timeout');
      sheet = parseTimesheetLines(lines);
    } catch (error) {
      this.fail(
        (error as Error).message === 'timeout'
          ? 'Reading this PDF took too long. Try again, or export the timesheet as a smaller PDF.'
          : 'This file could not be read as a PDF. It may be scanned, encrypted or damaged.'
      );
      return;
    }
    if (!sheet.days.length) {
      this.fail(
        'No daily rows were found. The PDF needs one row per day, like "Aug 3 Mon 11:00 AM 9:00 PM 10".'
      );
      return;
    }

    let logged: Set<string> = new Set();
    try {
      logged = await withTimeout(
        this.store.loggedDates(sheet.days[0].date, sheet.days.at(-1)!.date),
        LOGGED_CHECK_TIMEOUT_MS,
        'timeout'
      );
    } catch {
      // Without the check every day starts selected; the API still refuses clashing absences.
      this.loggedCheckFailed.set(true);
    }
    this.sheet.set(sheet);
    this.logged.set(logged);
    this.selected.set(
      new Set(sheet.days.filter((day) => !logged.has(day.date)).map((d) => d.date))
    );
    this.phase.set('review');
  }

  public toggle(day: ImportedDay): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(day.date)) next.delete(day.date);
      else next.add(day.date);
      return next;
    });
  }

  public toggleAll(): void {
    this.selected.set(this.allChosen() ? new Set() : new Set(this.days().map((day) => day.date)));
  }

  public setRate(value: string): void {
    this.rate.set(value === '' ? null : Number(value));
  }

  public async import(): Promise<void> {
    if (!this.canImport()) return;
    const rate = this.rate() ?? 0;
    const project = this.projectName().trim() || null;
    const note = `Imported from ${this.file().name}`;
    const inputs: DailySheetInput[] = this.chosen().map((day) => {
      const isWork = day.kind === 'work';
      return {
        entryType: day.kind,
        sheetDate: day.date,
        projectName: isWork ? project : null,
        startTime: isWork ? day.startTime : null,
        endTime: isWork ? day.endTime : null,
        breakMinutes: 0,
        ...(isWork && day.hours ? { hoursWorked: day.hours } : {}),
        hourlyRate: isWork ? rate : 0,
        isBillable: isWork,
        description: null,
        tasksCompleted: null,
        notes: note,
        lineItems: [],
      };
    });

    if (this.needsRate()) rememberRate(rate);
    this.progress.set(0);
    this.phase.set('importing');
    this.results.set(await this.store.importDailySheets(inputs, (done) => this.progress.set(done)));
    this.phase.set('done');
  }

  public close(): void {
    if (this.phase() === 'importing') return;
    this.closed.emit(this.firstImported());
  }

  public onEscape(): void {
    this.close();
  }

  private fail(message: string): void {
    this.errorMessage.set(message);
    this.phase.set('error');
  }
}
