import { Prisma } from '@prisma/client';
import { AppError } from '../../middleware/error';
import {
  addDays,
  amountInWordsINR,
  assertDraft,
  computeTotals,
  financialYearLabel,
  formatInvoiceNumber,
  monthPeriodLabel,
  parseDateKey,
} from './invoices.rules';

describe('financialYearLabel', () => {
  it('puts 31 March in the year that started the previous April', () => {
    expect(financialYearLabel(parseDateKey('2027-03-31'))).toBe('FY26-27');
  });

  it('starts a new year on 1 April', () => {
    expect(financialYearLabel(parseDateKey('2027-04-01'))).toBe('FY27-28');
  });

  it('crosses the century', () => {
    expect(financialYearLabel(parseDateKey('2099-12-01'))).toBe('FY99-00');
  });
});

describe('formatInvoiceNumber', () => {
  it('pads to two digits and keeps larger numbers whole', () => {
    expect(formatInvoiceNumber('FY26-27', 4)).toBe('FY26-27/04');
    expect(formatInvoiceNumber('FY26-27', 123)).toBe('FY26-27/123');
  });
});

describe('amountInWordsINR', () => {
  it.each([
    [60000, 'Sixty Thousand Only'],
    [100000, 'One Lakh Only'],
    [
      '1234567.50',
      'Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven and Fifty Paise Only',
    ],
    [0, 'Zero Only'],
    [10000000, 'One Crore Only'],
    [1015, 'One Thousand Fifteen Only'],
    ['0.05', 'Zero and Five Paise Only'],
  ])('%s → %s', (amount, words) => {
    expect(amountInWordsINR(amount)).toBe(words);
  });
});

describe('computeTotals', () => {
  it('rounds each line to paise before summing', () => {
    const totals = computeTotals(
      [
        { qty: '1.5', rate: '333.33' },
        { qty: 1, rate: '0.005' },
      ],
      0,
      0
    );
    expect(totals.lines.map(String)).toEqual(['500', '0.01']);
    expect(totals.subtotal.toString()).toBe('500.01');
  });

  it('adds tax and subtracts the advance', () => {
    const totals = computeTotals([{ qty: 1, rate: 60000 }], 18, 10000);
    expect(totals.taxAmount.toString()).toBe('10800');
    expect(totals.grandTotal.toString()).toBe('60800');
  });

  it('refuses an advance larger than the total', () => {
    expect(() => computeTotals([{ qty: 1, rate: 100 }], 0, new Prisma.Decimal(101))).toThrow(
      expect.objectContaining({ code: 'ADVANCE_TOO_HIGH' })
    );
  });
});

describe('dates and labels', () => {
  it('adds calendar days in UTC', () => {
    expect(addDays(parseDateKey('2026-09-28'), 7).toISOString().slice(0, 10)).toBe('2026-10-05');
  });

  it('labels a month the way the sample bill does', () => {
    expect(monthPeriodLabel(2026, 9)).toBe("For the month of September '26");
  });
});

describe('assertDraft', () => {
  it('locks anything but a draft', () => {
    expect(() => assertDraft({ status: 'DRAFT' })).not.toThrow();
    let error: unknown;
    try {
      assertDraft({ status: 'ISSUED' });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(409);
    expect((error as AppError).code).toBe('INVOICE_LOCKED');
  });
});
