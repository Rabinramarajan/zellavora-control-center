import { Prisma } from '@prisma/client';
import { AppError } from '../../middleware/error';

/** Pure invoice rules: numbering, totals and amount in words. Money stays in Decimal. */

/**
 * Indian financial year (April–March) for a date, e.g. "FY26-27". Invoice
 * dates are Postgres `date` values read back as UTC midnight, so UTC parts
 * are used to keep 1 April from slipping into the previous year.
 */
export const financialYearLabel = (date: Date): string => {
  const year = date.getUTCFullYear();
  const start = date.getUTCMonth() >= 3 ? year : year - 1;
  return `FY${String(start).slice(2)}-${String(start + 1).slice(2)}`;
};

/** "FY26-27/04". */
export const formatInvoiceNumber = (fyLabel: string, sequenceNo: number): string =>
  `${fyLabel}/${String(sequenceNo).padStart(2, '0')}`;

export interface TotalsInput {
  qty: Prisma.Decimal.Value;
  rate: Prisma.Decimal.Value;
}

export interface Totals {
  lines: Prisma.Decimal[];
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
}

/** grand total = subtotal + tax − advance; each line is rounded to paise first. */
export const computeTotals = (
  items: readonly TotalsInput[],
  taxRate: Prisma.Decimal.Value,
  advance: Prisma.Decimal.Value
): Totals => {
  const lines = items.map((item) => new Prisma.Decimal(item.qty).mul(item.rate).toDecimalPlaces(2));
  const subtotal = lines.reduce((sum, line) => sum.add(line), new Prisma.Decimal(0));
  const taxAmount = subtotal.mul(taxRate).div(100).toDecimalPlaces(2);
  const grandTotal = subtotal.add(taxAmount).sub(advance);
  if (grandTotal.isNegative()) {
    throw new AppError('The advance is more than the invoice total', 422, 'ADVANCE_TOO_HIGH');
  }
  return { lines, subtotal, taxAmount, grandTotal };
};

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const below100 = (n: number): string =>
  n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;

const below1000 = (n: number): string =>
  n >= 100
    ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${below100(n % 100)}` : ''}`
    : below100(n);

/** Indian numbering in words: 60000 → "Sixty Thousand Only". */
export const amountInWordsINR = (amount: Prisma.Decimal.Value): string => {
  const value = new Prisma.Decimal(amount).toDecimalPlaces(2);
  const whole = value.floor();
  const rupees = whole.toNumber();
  const paise = value.sub(whole).mul(100).round().toNumber();

  // Above 99 crore the crore part itself needs grouping.
  const crore = Math.floor(rupees / 1e7);
  const lakh = Math.floor((rupees % 1e7) / 1e5);
  const thousand = Math.floor((rupees % 1e5) / 1e3);
  const rest = rupees % 1e3;

  const parts: string[] = [];
  if (crore) parts.push(`${crore >= 100 ? below1000(crore) : below100(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (rest) parts.push(below1000(rest));

  let words = parts.join(' ') || 'Zero';
  if (paise) words += ` and ${below100(paise)} Paise`;
  return `${words} Only`;
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "For the month of September '26". */
export const monthPeriodLabel = (year: number, month: number): string =>
  `For the month of ${MONTHS[month - 1]} '${String(year).slice(2)}`;

/** Calendar days after a UTC-midnight date. */
export const addDays = (date: Date, days: number): Date => {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

/** "YYYY-MM-DD" → UTC midnight, matching how Postgres `date` columns read back. */
export const parseDateKey = (key: string): Date => new Date(`${key}T00:00:00.000Z`);

/** Only drafts may be edited, deleted or issued. */
export const assertDraft = (invoice: { status: string }): void => {
  if (invoice.status !== 'DRAFT') {
    throw new AppError(
      `Invoice is ${invoice.status.toLowerCase()} and locked`,
      409,
      'INVOICE_LOCKED'
    );
  }
};

/** "FY26-27/04" → its year and counter; any other numbering returns null. */
export const parseInvoiceNumber = (
  invoiceNumber: string
): { fyLabel: string; sequenceNo: number } | null => {
  const match = /^(FY\d{2}-\d{2})\/(\d{1,6})$/i.exec(invoiceNumber.trim());
  if (!match) return null;
  const sequenceNo = Number(match[2]);
  return sequenceNo > 0 ? { fyLabel: match[1].toUpperCase(), sequenceNo } : null;
};
