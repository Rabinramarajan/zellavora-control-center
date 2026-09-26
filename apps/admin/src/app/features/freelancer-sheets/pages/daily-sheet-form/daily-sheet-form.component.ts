import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { DateControl } from '@zellavoras/ui';
import { AuthStore } from '../../../../core/auth/auth.store';
import { SheetsApi } from '../../sheets.api';
import { SheetsStore } from '../../sheets.store';
import { DailySheet, DailySheetInput, EntryType, SheetRequestError } from '../../sheets.models';
import { isDayKey, isWeekendDayKey, parseDayKey, previewSheet, todayKey } from '../../sheets.time';
import { statusLabel, statusPill } from '../../sheets.presentation';

const LAST_RATE_KEY = 'zcc.sheets.lastHourlyRate';

/** Work-only rules are skipped for leave and holiday days, which carry no hours. */
const isWorkDay = (group: AbstractControl): boolean =>
  (group.get('entryType')?.value ?? 'work') === 'work';

/** Start and end are entered together or not at all. */
const pairedTimes = (group: AbstractControl): ValidationErrors | null => {
  if (!isWorkDay(group)) return null;
  const start = group.get('startTime')?.value;
  const end = group.get('endTime')?.value;
  return !start === !end ? null : { unpairedTimes: true };
};

/** A work day needs hours from somewhere: a span, typed hours or tasks. */
const hasHours = (group: AbstractControl): ValidationErrors | null => {
  if (!isWorkDay(group)) return null;
  const value = group.value as {
    startTime: string;
    hoursWorked: number | null;
    lineItems: { hours: number | null }[];
  };
  const taskHours = (value.lineItems ?? []).some((item) => (item.hours ?? 0) > 0);
  return value.startTime || (value.hoursWorked ?? 0) > 0 || taskHours ? null : { noHours: true };
};

/** A work day is billed, so it needs a rate. */
const rateForWork = (group: AbstractControl): ValidationErrors | null => {
  if (!isWorkDay(group)) return null;
  const rate = group.get('hourlyRate')?.value;
  return rate === null || rate === undefined || rate === '' ? { rateRequired: true } : null;
};

export const ENTRY_TYPE_OPTIONS: ReadonlyArray<{ value: EntryType; label: string; hint: string }> =
  [
    { value: 'work', label: 'Work', hint: 'Hours worked on this day' },
    { value: 'leave', label: 'Leave', hint: 'A day off, shown as LEAVE on the timesheet' },
    { value: 'holiday', label: 'Holiday', hint: 'A public or company holiday' },
  ];

type LineItemGroup = FormGroup<{
  taskName: FormControl<string>;
  hours: FormControl<number | null>;
  rate: FormControl<number | null>;
  description: FormControl<string>;
}>;

/**
 * Create, edit or view one daily sheet.
 *
 *   /freelancer-sheets/daily/new?date=YYYY-MM-DD   → create
 *   /freelancer-sheets/daily/:id/edit               → edit (owner, draft or rejected)
 *   /freelancer-sheets/daily/:id                    → read-only
 */
@Component({
  selector: 'app-daily-sheet-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DateControl],
  providers: [SheetsStore],
  templateUrl: './daily-sheet-form.component.html',
  styleUrls: ['../../styles/sheets-theme.css', './daily-sheet-form.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailySheetFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly api = inject(SheetsApi);
  private readonly store = inject(SheetsStore);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Route param; absent when creating. */
  private readonly id = signal(this.route.snapshot.paramMap.get('id'));
  /** `?date=` on the create route. */
  private readonly date = this.route.snapshot.queryParamMap.get('date');
  /** Route data: `edit` or `view`. */
  private readonly mode = signal<'edit' | 'view'>(
    this.route.snapshot.data['mode'] === 'view' ? 'view' : 'edit'
  );

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly confirmingDelete = signal(false);
  protected readonly sheet = signal<DailySheet | null>(null);
  /** Suggestions for the project field; typing anything else is fine too. */
  protected readonly projectSuggestions = signal<string[]>([]);

  /** Set once a save succeeds, so leaving afterwards is not "unsaved". */
  private saved = false;

  protected readonly form = this.fb.group(
    {
      entryType: this.fb.control<EntryType>('work'),
      sheetDate: [todayKey(), Validators.required],
      projectName: ['', Validators.maxLength(200)],
      startTime: [''],
      endTime: [''],
      breakMinutes: [0, [Validators.min(0), Validators.max(720)]],
      hoursWorked: this.fb.control<number | null>(null, [Validators.min(0.25), Validators.max(24)]),
      hourlyRate: this.fb.control<number | null>(this.rememberedRate(), [
        Validators.min(0),
        Validators.max(100000),
      ]),
      isBillable: [true],
      description: ['', Validators.maxLength(2000)],
      notes: ['', Validators.maxLength(5000)],
      lineItems: this.fb.array<LineItemGroup>([]),
    },
    { validators: [pairedTimes, hasHours, rateForWork] }
  );

  protected readonly value = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() }
  );

  protected readonly isWork = computed(() => (this.value().entryType ?? 'work') === 'work');

  /** Weekends are off by default: only work is logged on them. */
  protected readonly isWeekend = computed(() => isWeekendDayKey(this.value().sheetDate));

  protected readonly weekdayName = computed(() => {
    const date = this.value().sheetDate;
    return isDayKey(date) ? parseDayKey(date).toLocaleDateString('en-US', { weekday: 'long' }) : '';
  });

  public constructor() {
    // Leave or a holiday on a weekend would double-count a day already off.
    effect(() => {
      if (this.isWeekend() && !this.isWork() && !this.readOnly()) {
        this.form.controls.entryType.setValue('work');
      }
    });
  }

  protected readonly entryTypeOptions = ENTRY_TYPE_OPTIONS;

  protected readonly preview = computed(() => {
    const value = this.value();
    if (!this.isWork()) return { hours: 0, taskHours: 0, amount: 0, fromSpan: false };
    return previewSheet({
      startTime: value.startTime || null,
      endTime: value.endTime || null,
      breakMinutes: value.breakMinutes ?? 0,
      hoursWorked: value.hoursWorked ?? null,
      hourlyRate: value.hourlyRate ?? null,
      isBillable: value.isBillable ?? true,
      lineItems: (value.lineItems ?? []).map((item) => ({
        hours: item.hours ?? null,
        rate: item.rate ?? null,
      })),
    });
  });

  protected readonly isNew = computed(() => !this.id());

  /** Only the owner edits, and only before the sheet is signed off. */
  protected readonly readOnly = computed(() => {
    const sheet = this.sheet();
    if (!sheet) return false;
    const owner = sheet.userId === this.auth.user()?.id;
    const editable = sheet.status === 'draft' || sheet.status === 'rejected';
    return this.mode() === 'view' || !owner || !editable;
  });

  protected readonly canEditExisting = computed(() => {
    const sheet = this.sheet();
    return (
      !!sheet &&
      sheet.userId === this.auth.user()?.id &&
      (sheet.status === 'draft' || sheet.status === 'rejected')
    );
  });

  protected readonly title = computed(() => {
    if (this.isNew()) return 'New Daily Sheet';
    return this.readOnly() ? 'Daily Sheet' : 'Edit Daily Sheet';
  });

  protected readonly statusLabel = statusLabel;
  protected readonly statusPill = statusPill;

  public get lineItems(): FormArray<LineItemGroup> {
    return this.form.controls.lineItems;
  }

  public async ngOnInit(): Promise<void> {
    void this.loadProjects();

    const id = this.id();
    if (!id) {
      if (isDayKey(this.date)) this.form.controls.sheetDate.setValue(this.date);
      return;
    }

    this.loading.set(true);
    try {
      const sheet = await this.api.getDaily(id);
      this.sheet.set(sheet);
      this.patchForm(sheet);
      if (this.readOnly()) this.form.disable({ emitEvent: false });
    } catch (error) {
      const failure = error as SheetRequestError;
      this.loadError.set(
        failure.status === 404 ? 'This daily sheet does not exist or was deleted.' : failure.message
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected addLineItem(): void {
    this.lineItems.push(this.lineItemGroup());
  }

  protected removeLineItem(index: number): void {
    this.lineItems.removeAt(index);
    this.form.markAsDirty();
  }

  /** Clearing the span hands the hours back to the typed-in field. */
  protected clearTimes(): void {
    this.form.patchValue({ startTime: '', endTime: '', breakMinutes: 0 });
    this.form.markAsDirty();
  }

  /**
   * The date picker is a Signal Forms control, so it is wired to its reactive
   * control by hand instead of through `formControlName`.
   */
  protected setSheetDate(value: string): void {
    const control = this.form.controls.sheetDate;
    control.setValue(value);
    control.markAsDirty();
  }

  protected fieldInvalid(path: string): boolean {
    const control = this.form.get(path);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  protected async save(submitAfter: boolean): Promise<void> {
    this.formError.set(null);
    // An absence carries no tasks; half-filled task rows must not block it.
    if (!this.isWork()) this.lineItems.clear();
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.formError.set(this.describeFormErrors());
      return;
    }

    this.saving.set(true);
    try {
      const input = this.toInput();
      const existing = this.sheet();
      let sheet = existing
        ? await this.store.updateDailySheet(existing.id, input)
        : await this.store.createDailySheet(input);
      if (submitAfter) sheet = await this.store.submitDailySheet(sheet.id);

      this.rememberRate(input.hourlyRate);
      this.saved = true;
      await this.router.navigate(['/freelancer-sheets/daily'], {
        queryParams: { date: sheet.sheetDate },
      });
    } catch (error) {
      this.applyServerErrors(error as SheetRequestError);
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const sheet = this.sheet();
    if (!sheet) return;
    this.saving.set(true);
    try {
      await this.store.deleteDailySheet(sheet.id);
      this.saved = true;
      await this.router.navigate(['/freelancer-sheets/daily'], {
        queryParams: { date: sheet.sheetDate },
      });
    } catch (error) {
      this.formError.set((error as SheetRequestError).message);
    } finally {
      this.saving.set(false);
      this.confirmingDelete.set(false);
    }
  }

  protected async submitExisting(): Promise<void> {
    const sheet = this.sheet();
    if (!sheet) return;
    this.saving.set(true);
    try {
      const submitted = await this.store.submitDailySheet(sheet.id);
      this.sheet.set(submitted);
      this.form.disable({ emitEvent: false });
    } catch (error) {
      this.formError.set((error as SheetRequestError).message);
    } finally {
      this.saving.set(false);
    }
  }

  /** Used by the route's canDeactivate guard. */
  public canLeave(): boolean {
    if (this.saved || this.readOnly() || !this.form.dirty) return true;
    return window.confirm('You have unsaved changes. Leave this page and discard them?');
  }

  private lineItemGroup(item?: {
    taskName: string;
    hours: number;
    rate: number | null;
    description: string | null;
  }): LineItemGroup {
    return this.fb.group({
      taskName: [item?.taskName ?? '', [Validators.required, Validators.maxLength(200)]],
      hours: this.fb.control<number | null>(item?.hours ?? null, [
        Validators.required,
        Validators.min(0.25),
        Validators.max(24),
      ]),
      rate: this.fb.control<number | null>(item?.rate ?? null, [Validators.min(0)]),
      description: [item?.description ?? '', Validators.maxLength(2000)],
    });
  }

  private patchForm(sheet: DailySheet): void {
    this.lineItems.clear();
    for (const item of sheet.lineItems) this.lineItems.push(this.lineItemGroup(item));
    this.form.reset({
      entryType: sheet.entryType,
      sheetDate: sheet.sheetDate,
      projectName: sheet.projectName ?? '',
      startTime: sheet.startTime ?? '',
      endTime: sheet.endTime ?? '',
      breakMinutes: sheet.breakMinutes,
      hoursWorked: sheet.startTime ? null : sheet.hoursWorked,
      hourlyRate: sheet.hourlyRate,
      isBillable: sheet.isBillable,
      description: sheet.description ?? '',
      notes: sheet.notes ?? '',
    });
  }

  private toInput(): DailySheetInput {
    const value = this.form.getRawValue();
    if (value.entryType !== 'work') {
      return {
        entryType: value.entryType,
        sheetDate: value.sheetDate,
        projectName: null,
        startTime: null,
        endTime: null,
        breakMinutes: 0,
        hourlyRate: value.hourlyRate ?? 0,
        isBillable: false,
        description: value.description.trim() || null,
        tasksCompleted: null,
        notes: value.notes.trim() || null,
        lineItems: [],
      };
    }

    const hasSpan = Boolean(value.startTime && value.endTime);
    return {
      entryType: 'work',
      sheetDate: value.sheetDate,
      projectName: value.projectName.trim() || null,
      startTime: hasSpan ? value.startTime : null,
      endTime: hasSpan ? value.endTime : null,
      breakMinutes: hasSpan ? value.breakMinutes : 0,
      // A span decides the hours server-side; typed hours only apply without one.
      ...(hasSpan || !value.hoursWorked ? {} : { hoursWorked: value.hoursWorked }),
      hourlyRate: value.hourlyRate ?? 0,
      isBillable: value.isBillable,
      description: value.description.trim() || null,
      tasksCompleted: null,
      notes: value.notes.trim() || null,
      lineItems: value.lineItems.map((item) => ({
        taskName: item.taskName.trim(),
        hours: item.hours ?? 0,
        ...(item.rate !== null && item.rate !== undefined ? { rate: item.rate } : {}),
        ...(item.description.trim() ? { description: item.description.trim() } : {}),
      })),
    };
  }

  private describeFormErrors(): string {
    if (this.form.hasError('unpairedTimes'))
      return 'Enter both a start and an end time, or neither.';
    if (this.form.hasError('noHours')) {
      return 'Enter a start and end time, the hours worked, or at least one task.';
    }
    if (this.form.hasError('rateRequired')) return 'Enter the hourly rate for this work day.';
    return 'Please fix the highlighted fields.';
  }

  /** Put server validation messages next to the fields they belong to. */
  private applyServerErrors(error: SheetRequestError): void {
    for (const [path, message] of Object.entries(error.fields)) {
      this.form.get(path)?.setErrors({ server: message });
    }
    this.formError.set(error.message);
  }

  private async loadProjects(): Promise<void> {
    try {
      this.projectSuggestions.set(await this.api.projectSuggestions());
    } catch {
      // The picker is optional: without it a sheet is simply unassigned.
      this.projectSuggestions.set([]);
    }
  }

  private rememberedRate(): number | null {
    try {
      const stored = Number(localStorage.getItem(LAST_RATE_KEY));
      return Number.isFinite(stored) && stored > 0 ? stored : null;
    } catch {
      return null;
    }
  }

  private rememberRate(rate: number): void {
    try {
      localStorage.setItem(LAST_RATE_KEY, String(rate));
    } catch {
      // Storage can be unavailable (private mode); the default is a convenience only.
    }
  }
}
