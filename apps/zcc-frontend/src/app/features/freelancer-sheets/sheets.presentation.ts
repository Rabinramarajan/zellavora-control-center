/** Presentation helpers shared by the daily, monthly and approval sheet pages. */

import type { ApprovalMode } from '../../shared/models';

export type SheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';

/** Brand-adjacent hues, cycled so a project keeps the same colour everywhere. */
const PROJECT_PALETTE = [
  '#8b5cf6',
  '#38bdf8',
  '#22c55e',
  '#f43f5e',
  '#f59e0b',
  '#14b8a6',
  '#a855f7',
  '#60a5fa',
] as const;

/** Stable colour for a label — same name always lands on the same hue. */
export const paletteFor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PROJECT_PALETTE[hash % PROJECT_PALETTE.length];
};

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '?';

const STATUS_LABELS: Record<SheetStatus, string> = {
  draft: 'Draft',
  submitted: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
};

/**
 * Without a reviewer an approved sheet is simply final, and nothing is ever
 * pending or rejected, so the words follow the approval mode.
 */
export const statusLabel = (status: SheetStatus, mode: ApprovalMode = 'EXTERNAL'): string =>
  mode === 'NONE' && status === 'approved' ? 'Finalized' : (STATUS_LABELS[status] ?? status);

/** The statuses a filter should offer under a mode. */
export const statusesFor = <T extends SheetStatus>(
  statuses: readonly T[],
  mode: ApprovalMode
): T[] =>
  mode === 'NONE'
    ? statuses.filter((status) => status !== 'submitted' && status !== 'rejected')
    : [...statuses];

export interface ApprovalCopy {
  /** Label of the button that hands a sheet over. */
  submit: string;
  /** Busy label while that request runs. */
  submitting: string;
  /** Label for submitting a whole range of days at once. */
  submitAll: string;
  /** One line under the actions explaining what submitting does. */
  submitHint: string;
  /** Whether an approved sheet can be taken back to draft by its owner. */
  canReopen: boolean;
  /** The owner approves their own submitted sheets. */
  selfApproves: boolean;
}

const APPROVAL_COPY: Record<ApprovalMode, ApprovalCopy> = {
  NONE: {
    submit: 'Finalize',
    submitting: 'Finalizing…',
    submitAll: 'Finalize all drafts',
    submitHint: 'Finalizing locks the sheet. Reopen it if you need to change it later.',
    canReopen: true,
    selfApproves: false,
  },
  SELF: {
    submit: 'Submit',
    submitting: 'Submitting…',
    submitAll: 'Submit all drafts',
    submitHint: 'You approve your own submitted sheets from the Approval Queue.',
    canReopen: true,
    selfApproves: true,
  },
  EXTERNAL: {
    submit: 'Submit',
    submitting: 'Submitting…',
    submitAll: 'Submit all drafts',
    submitHint: 'A reviewer approves or sends back submitted sheets.',
    canReopen: false,
    selfApproves: false,
  },
};

export const approvalCopy = (mode: ApprovalMode): ApprovalCopy => APPROVAL_COPY[mode];

const STATUS_PILLS: Record<SheetStatus, string> = {
  draft: 'pill--draft',
  submitted: 'pill--pending',
  approved: 'pill--approved',
  rejected: 'pill--rejected',
  paid: 'pill--paid',
};

export const statusPill = (status: SheetStatus): string =>
  `pill ${STATUS_PILLS[status] ?? 'pill--draft'}`;

/** Local-time "YYYY-MM-DD", so day boundaries match what the user sees. */
export const isoDay = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Local-time "YYYY-MM". */
export const isoMonth = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const pad = (value: number): string => String(value).padStart(2, '0');
