/**
 * Pure calendar helpers for timesheet periods.
 *
 * Every date is built and read in UTC. Entry dates are stored as Postgres
 * `date` columns, so a local-timezone Date would drift a day either side of
 * midnight for anyone east or west of UTC.
 */

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export type DayName = (typeof DAY_NAMES)[number];

export interface CalendarDay {
  date: Date;
  /** "YYYY-MM-DD" */
  key: string;
  dayOfWeek: DayName;
  isWeekend: boolean;
}

/** Split "2026-08" into its numeric parts. Throws on a malformed period. */
export const parsePeriod = (period: string): { year: number; month: number } => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (!match) throw new Error(`Invalid period "${period}", expected YYYY-MM`);
  return { year: Number(match[1]), month: Number(match[2]) };
};

/** The period a given date falls in, e.g. "2026-08". */
export const periodOf = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

/** "YYYY-MM-DD" for a UTC date. */
export const dateKey = (date: Date): string => date.toISOString().slice(0, 10);

/** Midnight UTC for a "YYYY-MM-DD" string. */
export const parseDateKey = (key: string): Date => new Date(`${key}T00:00:00.000Z`);

/**
 * Every calendar day in the period, in order. This is what lets the frontend
 * render a month grid without doing any calendar arithmetic of its own.
 */
export const buildMonthDays = (period: string): CalendarDay[] => {
  const { year, month } = parsePeriod(period);
  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1, i + 1));
    const weekday = date.getUTCDay();
    return {
      date,
      key: dateKey(date),
      dayOfWeek: DAY_NAMES[weekday],
      isWeekend: weekday === 0 || weekday === 6,
    };
  });
};

/** True when the date falls inside the period. Used to reject stray writes. */
export const isDateInPeriod = (period: string, key: string): boolean =>
  key.startsWith(`${period}-`) && buildMonthDays(period).some((d) => d.key === key);
