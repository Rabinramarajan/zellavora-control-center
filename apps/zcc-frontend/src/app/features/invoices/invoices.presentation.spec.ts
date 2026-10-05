import {
  formatDateKey,
  formatRupees,
  isOverdue,
  lineValue,
  todayKey,
} from './invoices.presentation';

describe('invoices.presentation', () => {
  it('flags only issued invoices past their due date', () => {
    expect(isOverdue({ status: 'ISSUED', dueDate: '2026-10-01' }, '2026-10-05')).toBeTrue();
    expect(isOverdue({ status: 'ISSUED', dueDate: '2026-10-05' }, '2026-10-05')).toBeFalse();
    expect(isOverdue({ status: 'PAID', dueDate: '2026-10-01' }, '2026-10-05')).toBeFalse();
    expect(isOverdue({ status: 'ISSUED', dueDate: null }, '2026-10-05')).toBeFalse();
  });

  it('formats amounts with Indian grouping', () => {
    expect(formatRupees(60000)).toBe('60,000');
    expect(formatRupees(1234567.5)).toBe('12,34,567.5');
  });

  it('prints dates as dd/MM/yyyy', () => {
    expect(formatDateKey('2026-10-05')).toBe('05/10/2026');
    expect(formatDateKey(null)).toBe('—');
  });

  it('rounds display line values to paise', () => {
    expect(lineValue(1.5, 333.33)).toBe(500);
    expect(lineValue(Number.NaN, 10)).toBe(0);
  });

  it('builds a local date key', () => {
    expect(todayKey(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
});
