import {
  buildMonthDays,
  dateKey,
  isDateInPeriod,
  parseDateKey,
  parsePeriod,
  periodOf,
} from './timesheets.calendar';

describe('timesheets calendar', () => {
  describe('parsePeriod', () => {
    it('splits a period into year and month', () => {
      expect(parsePeriod('2026-08')).toEqual({ year: 2026, month: 8 });
    });

    it.each(['2026-13', '2026-00', '26-08', '2026-8', 'nonsense'])('rejects %s', (period) => {
      expect(() => parsePeriod(period)).toThrow(/Invalid period/);
    });
  });

  describe('buildMonthDays', () => {
    it('produces one entry per calendar day', () => {
      expect(buildMonthDays('2026-08')).toHaveLength(31);
      expect(buildMonthDays('2026-09')).toHaveLength(30);
    });

    it('handles leap years', () => {
      expect(buildMonthDays('2024-02')).toHaveLength(29);
      expect(buildMonthDays('2026-02')).toHaveLength(28);
    });

    it('flags weekends and names the weekday', () => {
      const days = buildMonthDays('2026-08');
      const first = days[0];

      // 1 August 2026 is a Saturday.
      expect(first.key).toBe('2026-08-01');
      expect(first.dayOfWeek).toBe('Saturday');
      expect(first.isWeekend).toBe(true);
      expect(days[2].dayOfWeek).toBe('Monday');
      expect(days[2].isWeekend).toBe(false);
    });

    it('keeps every day inside the requested month regardless of local timezone', () => {
      const days = buildMonthDays('2026-08');
      expect(days.every((day) => day.key.startsWith('2026-08-'))).toBe(true);
      expect(days.at(-1)?.key).toBe('2026-08-31');
    });
  });

  describe('date keys', () => {
    it('round-trips through parse and format', () => {
      expect(dateKey(parseDateKey('2026-08-17'))).toBe('2026-08-17');
    });

    it('derives the period from a date', () => {
      expect(periodOf(parseDateKey('2026-08-17'))).toBe('2026-08');
    });
  });

  describe('isDateInPeriod', () => {
    it('accepts a day inside the period', () => {
      expect(isDateInPeriod('2026-08', '2026-08-31')).toBe(true);
    });

    it('rejects a day from another month', () => {
      expect(isDateInPeriod('2026-08', '2026-09-01')).toBe(false);
    });

    it('rejects a day the month does not have', () => {
      expect(isDateInPeriod('2026-02', '2026-02-30')).toBe(false);
    });
  });
});
