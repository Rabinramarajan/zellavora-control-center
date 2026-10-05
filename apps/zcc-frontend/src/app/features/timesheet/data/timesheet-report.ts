/**
 * One computed shape behind the preview, the PDF and the Word file, so the
 * three can never disagree. Every figure comes from the entries; only the
 * signature lines are left for people to fill in.
 */
import { EntryStatus, Timesheet, TimesheetEntry, formatPeriod } from './timesheet.model';
import { formatTime, parseTime } from '../../../shared/components/time-picker/time-picker.utils';

/** Drives row shading in every output. */
export type ReportRowKind = 'work' | 'weekend-work' | 'leave' | 'holiday' | 'weekend' | 'blank';

export interface ReportRow {
  date: string;
  /** "Sep 1" */
  dateLabel: string;
  /** "Tue" */
  day: string;
  start: string;
  end: string;
  /** The hours cell as printed: "10", "LEAVE", "HOLIDAY" or "". */
  hours: string;
  /** "Working", "LEAVE", "Weekend work — Release support"… */
  statusNotes: string;
  kind: ReportRowKind;
}

export interface ReportSummary {
  workingDays: number;
  totalHours: number;
  leaveDates: string[];
  holidayDates: string[];
  weekendWorkDates: string[];
  overtimeDates: string[];
}

export interface TimesheetReport {
  title: string;
  employee: string;
  department: string;
  /** "September 2026" */
  periodLabel: string;
  /** "Sep 1 – Sep 30, 2026" */
  periodRange: string;
  period: string;
  status: Timesheet['status'];
  approverName: string | null;
  rows: ReportRow[];
  summary: ReportSummary;
  /** Plain-language schedule lines, e.g. "Regular hours: 10:00 AM – 8:00 PM (10 h)". */
  scheduleNotes: string[];
  /** Data problems worth fixing before the sheet is sent. */
  warnings: string[];
  overtimeThreshold: number;
  generatedAt: Date;
  /** "Timesheet_RabinR_2026-09" — no extension. */
  fileBaseName: string;
}

export interface ReportOptions {
  /** Hours above which a day counts as overtime. */
  overtimeThreshold?: number;
  now?: Date;
}

const STATUS_TEXT: Record<EntryStatus, string> = {
  EMPTY: '',
  WORKING: 'Working',
  EXTENDED: 'Extended',
  WEEKEND_WORK: 'Weekend work',
  LEAVE: 'LEAVE',
  HOLIDAY: 'HOLIDAY',
};

const isWeekend = (entry: TimesheetEntry): boolean =>
  entry.dayOfWeek === 'Saturday' || entry.dayOfWeek === 'Sunday';

const dateKey = (entry: TimesheetEntry): string => entry.entryDate.slice(0, 10);

const shortDate = (key: string): string =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

const formatHours = (hours: number): string =>
  Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0$/, '');

/** "Sep 2, Sep 8 and Sep 29" */
export const joinDates = (keys: readonly string[]): string => {
  const labels = keys.map(shortDate);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
};

/** A clock as the template prints it; unreadable text is shown as typed. */
const clock = (value: string | null): string => {
  const minutes = parseTime(value);
  return minutes === null ? (value ?? '') : formatTime(minutes);
};

const rowKind = (entry: TimesheetEntry): ReportRowKind => {
  switch (entry.status) {
    case 'LEAVE':
      return 'leave';
    case 'HOLIDAY':
      return 'holiday';
    case 'WEEKEND_WORK':
      return 'weekend-work';
    case 'WORKING':
    case 'EXTENDED':
      return isWeekend(entry) ? 'weekend-work' : 'work';
    default:
      if ((entry.hours ?? 0) > 0) return isWeekend(entry) ? 'weekend-work' : 'work';
      return isWeekend(entry) ? 'weekend' : 'blank';
  }
};

const toRow = (entry: TimesheetEntry): ReportRow => {
  const kind = rowKind(entry);
  const nonWorking = kind === 'leave' || kind === 'holiday';
  const status = STATUS_TEXT[entry.status] || ((entry.hours ?? 0) > 0 ? 'Working' : '');
  const notes = entry.notes?.trim() ?? '';
  return {
    date: dateKey(entry),
    dateLabel: shortDate(dateKey(entry)),
    day: entry.dayOfWeek.slice(0, 3),
    start: nonWorking ? '-' : clock(entry.startTime),
    end: nonWorking ? '-' : clock(entry.endTime),
    hours: nonWorking
      ? STATUS_TEXT[entry.status]
      : entry.hours === null || entry.hours === 0
        ? ''
        : formatHours(entry.hours),
    statusNotes: [status, notes].filter(Boolean).join(' — '),
    kind,
  };
};

/** The most common start–end pair across worked days, e.g. "10:00 AM – 8:00 PM". */
const regularSchedule = (entries: readonly TimesheetEntry[]): string | null => {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const start = parseTime(entry.startTime);
    const end = parseTime(entry.endTime);
    if (start === null || end === null) continue;
    const key = `${formatTime(start)} – ${formatTime(end)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [key, count] of counts) {
    if (best === null || count > (counts.get(best) ?? 0)) best = key;
  }
  return best;
};

const fileSafe = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '')
    .slice(0, 60) || 'Employee';

export function buildTimesheetReport(
  sheet: Timesheet,
  options: ReportOptions = {}
): TimesheetReport {
  const threshold = options.overtimeThreshold ?? 8;
  const entries = [...sheet.entries].sort((a, b) => dateKey(a).localeCompare(dateKey(b)));
  const rows = entries.map(toRow);
  const worked = entries.filter((entry) => (entry.hours ?? 0) > 0);

  const summary: ReportSummary = {
    workingDays: worked.length,
    totalHours: Math.round(worked.reduce((sum, entry) => sum + (entry.hours ?? 0), 0) * 100) / 100,
    leaveDates: entries.filter((e) => e.status === 'LEAVE').map(dateKey),
    holidayDates: entries.filter((e) => e.status === 'HOLIDAY').map(dateKey),
    weekendWorkDates: worked.filter(isWeekend).map(dateKey),
    overtimeDates: worked.filter((e) => (e.hours ?? 0) > threshold).map(dateKey),
  };

  const schedule = regularSchedule(worked);
  const typicalHours = worked.length
    ? formatHours(Math.round((summary.totalHours / worked.length) * 100) / 100)
    : null;
  const scheduleNotes = [
    schedule
      ? `Regular hours: ${schedule}${typicalHours ? ` (${typicalHours} h average per working day)` : ''}`
      : 'Regular hours: no start and end times recorded.',
    summary.overtimeDates.length
      ? `Overtime (over ${threshold} h): ${joinDates(summary.overtimeDates)}.`
      : `Overtime (over ${threshold} h): none.`,
    summary.weekendWorkDates.length
      ? `Weekend work: ${joinDates(summary.weekendWorkDates)}.`
      : 'Weekend work: none.',
    summary.leaveDates.length
      ? `Leave days: ${joinDates(summary.leaveDates)}.`
      : 'Leave days: none.',
    ...(summary.holidayDates.length ? [`Holidays: ${joinDates(summary.holidayDates)}.`] : []),
  ];

  const warnings: string[] = [];
  for (const entry of worked) {
    const label = shortDate(dateKey(entry));
    if (entry.startTime && !entry.endTime) warnings.push(`${label}: end time is missing.`);
    if (!entry.startTime && entry.endTime) warnings.push(`${label}: start time is missing.`);
  }
  for (const entry of entries) {
    if (
      (entry.status === 'WORKING' ||
        entry.status === 'EXTENDED' ||
        entry.status === 'WEEKEND_WORK') &&
      !(entry.hours ?? 0)
    ) {
      warnings.push(`${shortDate(dateKey(entry))}: marked as worked but has no hours.`);
    }
  }
  if (Math.abs(Number(sheet.totalHours) - summary.totalHours) > 0.009) {
    warnings.push(
      `Saved total (${formatHours(Number(sheet.totalHours))} h) differs from the rows (${formatHours(summary.totalHours)} h). Reload before sending.`
    );
  }

  const employee = sheet.employeeName || sheet.user.fullName;
  const first = entries[0] ? dateKey(entries[0]) : `${sheet.period}-01`;
  const last = entries.at(-1) ? dateKey(entries.at(-1)!) : first;

  return {
    title: 'TIMESHEET',
    employee,
    department: sheet.department || sheet.user.department || '—',
    periodLabel: formatPeriod(sheet.period),
    periodRange: `${shortDate(first)} – ${shortDate(last)}, ${sheet.period.slice(0, 4)}`,
    period: sheet.period,
    status: sheet.status,
    approverName: sheet.approver?.fullName ?? null,
    rows,
    summary,
    scheduleNotes,
    warnings,
    overtimeThreshold: threshold,
    generatedAt: options.now ?? new Date(),
    fileBaseName: `Timesheet_${fileSafe(employee)}_${sheet.period}`,
  };
}
