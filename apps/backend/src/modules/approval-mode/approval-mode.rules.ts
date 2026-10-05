import { ApprovalMode } from '@prisma/client';
import { AppError } from '../../middleware/error';

/**
 * Sign-off rules shared by daily sheets, monthly sheets and timesheets. The
 * mode that applies is always the sheet owner's, never the reviewer's.
 */

export interface ApprovalActor {
  userId: string;
  canReview: boolean;
}

/** Approve and reject exist only where somebody is expected to sign off. */
export const assertReviewAllowed = (
  mode: ApprovalMode,
  sheet: { userId: string },
  actor: ApprovalActor
): void => {
  if (mode === ApprovalMode.NONE) {
    throw new AppError(
      'Approval is turned off: submitting finalizes the sheet',
      409,
      'APPROVAL_DISABLED'
    );
  }
  if (!actor.canReview) {
    throw new AppError('Insufficient permission', 403, 'FORBIDDEN_PERMISSION');
  }
  if (mode === ApprovalMode.EXTERNAL && sheet.userId === actor.userId) {
    throw new AppError('You cannot review your own sheet', 403, 'SELF_REVIEW_FORBIDDEN');
  }
};

/** Without a reviewer the owner records their own payment. */
export const assertCanMarkPaid = (
  mode: ApprovalMode,
  sheet: { userId: string },
  actor: ApprovalActor
): void => {
  if (mode === ApprovalMode.NONE && sheet.userId === actor.userId) return;
  if (!actor.canReview) {
    throw new AppError('Insufficient permission', 403, 'FORBIDDEN_PERMISSION');
  }
  if (mode === ApprovalMode.EXTERNAL && sheet.userId === actor.userId) {
    throw new AppError('You cannot mark your own sheet as paid', 403, 'SELF_REVIEW_FORBIDDEN');
  }
};

/**
 * Reopening takes the place of rejection when the owner signs off their own
 * work. Under an external reviewer the reviewer rejects instead, so an owner
 * cannot quietly withdraw a sheet that was already signed off.
 */
export const assertCanReopen = (
  mode: ApprovalMode,
  sheet: { userId: string; approved: boolean; paid?: boolean },
  actorUserId: string
): void => {
  if (mode === ApprovalMode.EXTERNAL) {
    throw new AppError(
      'Approved sheets can only be changed by a reviewer rejecting them',
      409,
      'REOPEN_NOT_ALLOWED'
    );
  }
  if (sheet.userId !== actorUserId) {
    throw new AppError('Only the owner can reopen this sheet', 403, 'NOT_SHEET_OWNER');
  }
  if (sheet.paid) {
    throw new AppError('Paid sheets cannot be reopened', 409, 'SHEET_PAID');
  }
  if (!sheet.approved) {
    throw new AppError('Only approved sheets can be reopened', 409, 'SHEET_NOT_APPROVED');
  }
};

/** Submitting finalizes in one step when nobody reviews. */
export const autoApproves = (mode: ApprovalMode): boolean => mode === ApprovalMode.NONE;
