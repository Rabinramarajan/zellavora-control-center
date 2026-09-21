/** Presentation helpers shared by the daily, monthly and approval sheet pages. */

export type SheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';

/** Brand-adjacent hues, cycled so a project keeps the same colour everywhere. */
export const PROJECT_PALETTE = [
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

export const statusLabel = (status: SheetStatus): string => STATUS_LABELS[status] ?? status;

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
