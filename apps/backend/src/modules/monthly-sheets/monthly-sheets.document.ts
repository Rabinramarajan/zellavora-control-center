/**
 * The printable monthly timesheet: one row per calendar day, a summary, the
 * work-schedule notes and the approval blocks, laid out like the paper form
 * the team signs. Built from daily sheets by a pure function so the page,
 * a future PDF renderer and the tests all read the same figures.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type DocumentRowKind =
  'blank' | 'working' | 'extended' | 'weekend_work' | 'leave' | 'holiday';

export interface DocumentRow {
  /** "YYYY-MM-DD" */
  date: string;
  /** "Aug 1" */
  dateLabel: string;
  /** "Sat" */
  day: string;
  isWeekend: boolean;
  kind: DocumentRowKind;
  /** "11:00 AM", or null when nothing was logged. */
  startTime: string | null;
  endTime: string | null;
  hours: number | null;
  /** Text for the Status/Notes column, e.g. "Working" or "LEAVE". */
  statusLabel: string;
  notes: string | null;
}

export interface DocumentSchedule {
  startTime: string;
  endTime: string;
  hours: number;
}

export interface MonthlyDocument {
  month: number;
  year: number;
  /** "Aug 1 - Aug 31, 2026" */
  periodLabel: string;
  employee: { id: string; name: string; department: string | null; jobTitle: string | null };
  /** `preview` until a monthly sheet has been submitted; then that sheet's status. */
  status: string;
  monthlySheetId: string | null;
  totalHours: number;
  rows: DocumentRow[];
  summary: {
    workingDays: number;
    leaveDays: number;
    leaveDates: string[];
    holidayDays: number;
    holidayDates: string[];
    extendedDates: string[];
    weekendWorkDates: string[];
    totalHours: number;
  };
  /** The usual working pattern, when one stands out. */
  schedule: DocumentSchedule | null;
  approvals: {
    submittedAt: string | null;
    approvedAt: string | null;
    approverName: string | null;
    paidAt: string | null;
  };
  /** Daily sheets in the month not yet approved, so not on an official sheet. */
  pendingDailyCount: number;
}

export interface DocumentDaily {
  sheetDate: Date;
  entryType: string;
  startTime: string | null;
  endTime: string | null;
  hoursWorked: number;
  description: string | null;
}

export interface DocumentInput {
  year: number;
  month: number;
  employee: MonthlyDocument['employee'];
  dailies: readonly DocumentDaily[];
  monthly: {
    id: string;
    status: string;
    submittedAt: Date | null;
    approvedAt: Date | null;
    approverName: string | null;
    paidAt: Date | null;
  } | null;
  pendingDailyCount: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** "13:00" → "1:00 PM", matching the signed paper form. */
export const toTwelveHour = (clock: string): string => {
  const [hours, minutes] = clock.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

/** Most frequent value, or null when there is nothing to count. */
const mostCommon = <T>(values: readonly T[], key: (value: T) => string): T | null => {
  const counts = new Map<string, { value: T; count: number }>();
  for (const value of values) {
    const k = key(value);
    const entry = counts.get(k);
    counts.set(k, { value, count: (entry?.count ?? 0) + 1 });
  }
  let best: { value: T; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best?.value ?? null;
};

interface DayWork {
  start: string | null;
  end: string | null;
  hours: number;
  notes: string[];
}

export const buildMonthlyDocument = (input: DocumentInput): MonthlyDocument => {
  const { year, month } = input;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthName = MONTHS[month - 1];

  // Group the month's entries by day: absences win, work is summed.
  const absences = new Map<string, 'leave' | 'holiday'>();
  const work = new Map<string, DayWork>();
  for (const daily of input.dailies) {
    const key = dayKey(daily.sheetDate);
    if (daily.entryType === 'leave' || daily.entryType === 'holiday') {
      absences.set(key, daily.entryType);
      continue;
    }
    const day = work.get(key) ?? { start: null, end: null, hours: 0, notes: [] };
    if (daily.startTime && (!day.start || daily.startTime < day.start)) day.start = daily.startTime;
    if (daily.endTime && (!day.end || daily.endTime > day.end)) day.end = daily.endTime;
    day.hours = round2(day.hours + daily.hoursWorked);
    if (daily.description) day.notes.push(daily.description);
    work.set(key, day);
  }

  // The regular schedule is the most common weekday pattern.
  const weekdayWork = [...work.entries()]
    .filter(([key]) => {
      const weekday = new Date(`${key}T00:00:00.000Z`).getUTCDay();
      return weekday !== 0 && weekday !== 6 && !absences.has(key);
    })
    .map(([, day]) => day);
  const usualSpan = mostCommon(
    weekdayWork.filter((day) => day.start && day.end),
    (day) => `${day.start}|${day.end}`
  );
  const usualHours = mostCommon(weekdayWork, (day) => String(day.hours))?.hours ?? null;
  const schedule: DocumentSchedule | null =
    usualSpan?.start && usualSpan.end && usualHours !== null
      ? {
          startTime: toTwelveHour(usualSpan.start),
          endTime: toTwelveHour(usualSpan.end),
          hours: usualHours,
        }
      : null;

  const rows: DocumentRow[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const key = dayKey(date);
    const weekday = date.getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const base = { date: key, dateLabel: `${monthName} ${day}`, day: WEEKDAYS[weekday], isWeekend };

    const absence = absences.get(key);
    if (absence) {
      rows.push({
        ...base,
        kind: absence,
        startTime: null,
        endTime: null,
        hours: null,
        statusLabel: absence === 'leave' ? 'LEAVE' : 'HOLIDAY',
        notes: null,
      });
      continue;
    }

    const logged = work.get(key);
    if (!logged || logged.hours <= 0) {
      rows.push({
        ...base,
        kind: 'blank',
        startTime: null,
        endTime: null,
        hours: null,
        statusLabel: '',
        notes: null,
      });
      continue;
    }

    const kind: DocumentRowKind = isWeekend
      ? 'weekend_work'
      : usualHours !== null && logged.hours > usualHours
        ? 'extended'
        : 'working';
    rows.push({
      ...base,
      kind,
      startTime: logged.start ? toTwelveHour(logged.start) : null,
      endTime: logged.end ? toTwelveHour(logged.end) : null,
      hours: logged.hours,
      statusLabel:
        kind === 'weekend_work' ? 'Weekend work' : kind === 'extended' ? 'Extended' : 'Working',
      notes: logged.notes.length ? logged.notes.join('; ') : null,
    });
  }

  const labelsOf = (kind: DocumentRowKind): string[] =>
    rows.filter((row) => row.kind === kind).map((row) => row.dateLabel);
  const workedRows = rows.filter(
    (row) => row.kind === 'working' || row.kind === 'extended' || row.kind === 'weekend_work'
  );
  const totalHours = round2(workedRows.reduce((sum, row) => sum + (row.hours ?? 0), 0));
  const lastDay = `${monthName} ${daysInMonth}`;

  return {
    month,
    year,
    periodLabel: `${monthName} 1 - ${lastDay}, ${year}`,
    employee: input.employee,
    status: input.monthly && input.monthly.status !== 'draft' ? input.monthly.status : 'preview',
    monthlySheetId: input.monthly?.id ?? null,
    totalHours,
    rows,
    summary: {
      workingDays: workedRows.length,
      leaveDays: labelsOf('leave').length,
      leaveDates: labelsOf('leave'),
      holidayDays: labelsOf('holiday').length,
      holidayDates: labelsOf('holiday'),
      extendedDates: labelsOf('extended'),
      weekendWorkDates: labelsOf('weekend_work'),
      totalHours,
    },
    schedule,
    approvals: {
      submittedAt: input.monthly?.submittedAt?.toISOString() ?? null,
      approvedAt: input.monthly?.approvedAt?.toISOString() ?? null,
      approverName: input.monthly?.approverName ?? null,
      paidAt: input.monthly?.paidAt?.toISOString() ?? null,
    },
    pendingDailyCount: input.pendingDailyCount,
  };
};
