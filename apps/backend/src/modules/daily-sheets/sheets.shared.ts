import { NextFunction, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { PermissionService } from '../../services/auth/permission.service';
import { REVIEW_PERMISSION, TimesheetViewer } from '../timesheets/timesheets.rules';

/** Rules shared by daily and monthly freelancer sheets. */

export type SheetViewer = TimesheetViewer;

/** Statuses in which the owner may still change or delete a sheet. */
export const EDITABLE_SHEET_STATUSES = ['draft', 'rejected'] as const;

/**
 * Validation failures are the caller's fault, so they answer 400 with the
 * offending fields rather than falling through to a generic 500.
 */
const toClientError = (error: unknown): unknown => {
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return new AppError(
      first ? `${first.path.join('.') || 'request'}: ${first.message}` : 'Invalid request',
      400,
      'VALIDATION_ERROR',
      {
        fields: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }
    );
  }
  return error;
};

/**
 * Express 4 does not forward a rejected promise to the error middleware, so
 * without this wrapper a thrown `AppError` leaves the request hanging.
 */
export const asyncRoute =
  (fn: (req: AuthRequest, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => {
    Promise.resolve(fn(req as AuthRequest, res)).catch((error) => next(toClientError(error)));
  };

/** Tenant and caller always come from the verified token, never the body. */
export const requestContext = (req: AuthRequest): { organizationId: string; userId: string } => {
  if (!req.tenantId || !req.userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }
  return { organizationId: req.tenantId, userId: req.userId };
};

/** The caller plus whether they may review other people's sheets. */
export const resolveViewer = async (req: AuthRequest): Promise<SheetViewer> => {
  const { organizationId, userId } = requestContext(req);
  if (!req.permissions) {
    req.permissions = await PermissionService.loadForUser(userId, organizationId);
  }
  return { userId, canReview: PermissionService.has(req.permissions, REVIEW_PERMISSION) };
};

export const isEditableSheetStatus = (status: string): boolean =>
  (EDITABLE_SHEET_STATUSES as readonly string[]).includes(status);

/**
 * A sheet someone may not see is reported as missing, so ids cannot be used
 * to probe for colleagues' records.
 */
export const assertCanViewSheet = (sheet: { userId: string }, viewer: SheetViewer): void => {
  if (sheet.userId !== viewer.userId && !viewer.canReview) {
    throw new AppError('Sheet not found', 404, 'SHEET_NOT_FOUND');
  }
};

/** Only the owner edits, submits or deletes, and only before sign-off. */
export const assertOwnerCanChange = (
  sheet: { userId: string; status: string },
  userId: string
): void => {
  if (sheet.userId !== userId) {
    throw new AppError('Only the owner can change this sheet', 403, 'NOT_SHEET_OWNER');
  }
  if (!isEditableSheetStatus(sheet.status)) {
    throw new AppError(`Sheet is ${sheet.status} and locked for editing`, 409, 'SHEET_LOCKED');
  }
};

/** Separation of duties: a reviewer never signs off their own hours. */
export const assertCanDecide = (sheet: { userId: string }, viewer: SheetViewer): void => {
  if (!viewer.canReview) {
    throw new AppError('Insufficient permission', 403, 'FORBIDDEN_PERMISSION');
  }
  if (sheet.userId === viewer.userId) {
    throw new AppError('You cannot review your own sheet', 403, 'SELF_REVIEW_FORBIDDEN');
  }
};

/** Creating or listing on behalf of someone else is a reviewer-only act. */
export const assertCanActFor = (targetUserId: string | undefined, viewer: SheetViewer): void => {
  if (targetUserId && targetUserId !== viewer.userId && !viewer.canReview) {
    throw new AppError(
      "You do not have permission to access other people's sheets",
      403,
      'FORBIDDEN_PERMISSION'
    );
  }
};

/** The team-wide view is for reviewers; `mine` is open to everyone. */
export const assertCanListScope = (scope: 'mine' | 'team', viewer: SheetViewer): void => {
  if (scope === 'team' && !viewer.canReview) {
    throw new AppError('Insufficient permission', 403, 'FORBIDDEN_PERMISSION');
  }
};

/** Minutes since midnight for "HH:mm". */
export const clockToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Hours worked between two wall-clock times, less the break. An end time
 * earlier than the start is read as an overnight shift.
 */
export const hoursBetween = (start: string, end: string, breakMinutes: number): number => {
  let span = clockToMinutes(end) - clockToMinutes(start);
  if (span <= 0) span += 24 * 60;
  return Math.round(((span - breakMinutes) / 60) * 100) / 100;
};

/** "YYYY-MM-DD" for a Postgres `date` column read back as UTC midnight. */
export const toDateKey = (date: Date): string => date.toISOString().slice(0, 10);

/** One page of a list endpoint. */
export interface Paged<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
