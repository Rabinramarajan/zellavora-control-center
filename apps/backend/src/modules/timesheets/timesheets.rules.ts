import { TimesheetStatus, TimesheetEntryStatus } from '@prisma/client';
import { AppError } from '../../middleware/error';

/** Statuses in which the owning employee may still change entries. */
export const EDITABLE_STATUSES: TimesheetStatus[] = [
  TimesheetStatus.DRAFT,
  TimesheetStatus.REJECTED,
];

/** Statuses that carry no hours — the grid shows these rows as non-working. */
export const NON_WORKING_STATUSES: TimesheetEntryStatus[] = [
  TimesheetEntryStatus.LEAVE,
  TimesheetEntryStatus.HOLIDAY,
];

export const isEditableStatus = (status: TimesheetStatus): boolean =>
  EDITABLE_STATUSES.includes(status);

/**
 * Entries are the employee's own record, so only the owner may touch them,
 * and only while the sheet has not gone to a manager. A manager who wants it
 * changed rejects it, which puts it back into REJECTED and reopens editing.
 */
export const assertEntriesEditable = (
  sheet: { userId: string; status: TimesheetStatus },
  actorUserId: string
): void => {
  if (sheet.userId !== actorUserId) {
    throw new AppError('Only the owning employee can edit this timesheet', 403, 'NOT_SHEET_OWNER');
  }
  if (!isEditableStatus(sheet.status)) {
    throw new AppError(
      `Timesheet is ${sheet.status.toLowerCase()} and locked for editing`,
      409,
      'TIMESHEET_LOCKED'
    );
  }
};

/** Permission that lets a user see and decide on other people's timesheets. */
export const REVIEW_PERMISSION = 'timesheet:approve';

/** Who is asking, and whether they may look beyond their own sheets. */
export interface TimesheetViewer {
  userId: string;
  canReview: boolean;
}

/**
 * Owners always see their own sheet; anyone else needs the review
 * permission. The error is a 404 rather than a 403 so a caller cannot
 * confirm that a colleague's sheet exists by probing ids.
 */
export const assertCanView = (sheet: { userId: string }, viewer: TimesheetViewer): void => {
  if (sheet.userId !== viewer.userId && !viewer.canReview) {
    throw new AppError('Timesheet not found', 404, 'TIMESHEET_NOT_FOUND');
  }
};

/** Reading anyone but yourself is a reviewer-only query. */
export const assertCanQueryEmployee = (
  employeeId: string | undefined,
  viewer: TimesheetViewer
): void => {
  if (employeeId && employeeId !== viewer.userId && !viewer.canReview) {
    throw new AppError(
      "You do not have permission to view other employees' timesheets",
      403,
      'FORBIDDEN_PERMISSION'
    );
  }
};

/** Separation of duties: nobody signs off their own hours. */
export const assertNotOwnSheet = (sheet: { userId: string }, reviewerUserId: string): void => {
  if (sheet.userId === reviewerUserId) {
    throw new AppError(
      'You cannot approve or reject your own timesheet',
      403,
      'SELF_REVIEW_FORBIDDEN'
    );
  }
};

/** Allowed status moves. Anything absent here is rejected. */
const TRANSITIONS: Record<TimesheetStatus, TimesheetStatus[]> = {
  [TimesheetStatus.DRAFT]: [TimesheetStatus.SUBMITTED],
  [TimesheetStatus.SUBMITTED]: [TimesheetStatus.APPROVED, TimesheetStatus.REJECTED],
  [TimesheetStatus.REJECTED]: [TimesheetStatus.SUBMITTED],
  [TimesheetStatus.APPROVED]: [],
};

export const canTransition = (from: TimesheetStatus, to: TimesheetStatus): boolean =>
  TRANSITIONS[from].includes(to);

export const assertTransition = (from: TimesheetStatus, to: TimesheetStatus): void => {
  if (!canTransition(from, to)) {
    throw new AppError(
      `Cannot move a timesheet from ${from.toLowerCase()} to ${to.toLowerCase()}`,
      409,
      'INVALID_TIMESHEET_TRANSITION'
    );
  }
};

export interface EntryValues {
  startTime?: string | null;
  endTime?: string | null;
  hours?: number | null;
  status?: TimesheetEntryStatus;
  notes?: string | null;
}

/**
 * Reconcile a patch against the row it applies to.
 *
 * Leave and holiday days never carry hours or clock times, whichever order
 * the client sent the fields in — so the resulting status decides, not the
 * presence of an `hours` key in the payload.
 */
export const normalizeEntry = (
  current: { status: TimesheetEntryStatus; hours: number | null },
  patch: EntryValues
): EntryValues => {
  const status = patch.status ?? current.status;
  const next: EntryValues = { ...patch, status };

  if (NON_WORKING_STATUSES.includes(status)) {
    next.hours = null;
    next.startTime = null;
    next.endTime = null;
    return next;
  }

  const hours = patch.hours !== undefined ? patch.hours : current.hours;
  if (hours !== null && hours !== undefined && (hours < 0 || hours > 24)) {
    throw new AppError('hours must be between 0 and 24', 400, 'INVALID_ENTRY_HOURS');
  }
  return next;
};
