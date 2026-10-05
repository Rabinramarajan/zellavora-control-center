import { Invoice, InvoiceStatus } from './invoices.models';

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

/** Reuses the sheet pill colours so statuses read the same across Freelancer pages. */
const STATUS_PILLS: Record<InvoiceStatus, string> = {
  DRAFT: 'pill--draft',
  ISSUED: 'pill--pending',
  PAID: 'pill--paid',
  CANCELLED: 'pill--rejected',
};

export const invoiceStatusLabel = (status: InvoiceStatus): string => STATUS_LABELS[status];

export const invoiceStatusPill = (status: InvoiceStatus): string => STATUS_PILLS[status];

/** Local "YYYY-MM-DD" for today. */
export const todayKey = (now: Date = new Date()): string => {
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
};

/** Issued and unpaid past the due date. Date keys compare correctly as strings. */
export const isOverdue = (
  invoice: Pick<Invoice, 'status' | 'dueDate'>,
  today: string = todayKey()
): boolean => invoice.status === 'ISSUED' && !!invoice.dueDate && invoice.dueDate < today;

const RUPEES = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export const formatRupees = (value: number): string => RUPEES.format(value);

/** "YYYY-MM-DD" → "dd/MM/yyyy", as printed on the bill. */
export const formatDateKey = (key: string | null): string => {
  if (!key) return '—';
  const [year, month, day] = key.split('-');
  return `${day}/${month}/${year}`;
};

/** Display-only line value; the server recomputes every amount on save. */
export const lineValue = (qty: number, rate: number): number =>
  Math.round((Number(qty) || 0) * (Number(rate) || 0) * 100) / 100;
