/**
 * Types mirroring the Prisma `Timesheet` / `TimesheetEntry` models.
 *
 * Decimal columns arrive as JSON numbers and dates as ISO strings, so the
 * numeric and date fields here are narrower than their Prisma counterparts.
 */

export const TIMESHEET_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number];

export const ENTRY_STATUSES = [
  'EMPTY',
  'WORKING',
  'EXTENDED',
  'WEEKEND_WORK',
  'LEAVE',
  'HOLIDAY',
] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

/** Statuses that carry no hours — the grid blanks and disables their inputs. */
export const NON_WORKING_STATUSES: readonly EntryStatus[] = ['LEAVE', 'HOLIDAY'];

/** Statuses in which the owning employee may still edit entries. */
export const EDITABLE_STATUSES: readonly TimesheetStatus[] = ['DRAFT', 'REJECTED'];

export interface TimesheetEntry {
  id: string;
  timesheetId: string;
  /** ISO date of the calendar day this row covers. */
  entryDate: string;
  dayOfWeek: string;
  startTime: string | null;
  endTime: string | null;
  hours: number | null;
  status: EntryStatus;
  notes: string | null;
}

export interface TimesheetPerson {
  id: string;
  fullName: string;
  email: string;
  jobTitle?: string | null;
}

export interface Timesheet {
  id: string;
  organizationId: string;
  userId: string;
  /** "YYYY-MM" */
  period: string;
  status: TimesheetStatus;
  totalHours: number;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedById: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  entries: TimesheetEntry[];
  user: TimesheetPerson;
  approver: TimesheetPerson | null;
}

/** The four figures the summary card shows, plus the breakdown behind them. */
export interface TimesheetTotals {
  totalHours: number;
  workingDays: number;
  leaveDays: number;
  holidayDays: number;
  extendedDays: number;
  weekendWorkDays: number;
}

export interface TimesheetPeriodSummary {
  period: string;
  status: TimesheetStatus;
  totalHours: number;
  workingDays: number;
  leaveDays: number;
}

export interface TimesheetYearSummary {
  year: number;
  totalHours: number;
  workingDays: number;
  leaveDays: number;
  approvedPeriods: number;
  periods: TimesheetPeriodSummary[];
}

/** The fields a client may change on an entry. */
export interface EntryPatch {
  startTime?: string | null;
  endTime?: string | null;
  hours?: number | null;
  status?: EntryStatus;
  notes?: string | null;
}

export interface BulkEntryPatch extends EntryPatch {
  /** "YYYY-MM-DD" */
  date: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export const isEditable = (status: TimesheetStatus): boolean =>
  EDITABLE_STATUSES.includes(status);

export const isNonWorking = (status: EntryStatus): boolean =>
  NON_WORKING_STATUSES.includes(status);

/** "2026-08" → "August 2026". */
export const formatPeriod = (period: string): string => {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

/** "YYYY-MM" for a date, used to seed the period picker. */
export const periodOf = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
