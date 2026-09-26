import { hoursBetween, isDayKey, parseDayKey, previewSheet } from './sheets.time';

describe('sheet time helpers', () => {
  describe('hoursBetween', () => {
    it('subtracts the break', () => {
      expect(hoursBetween('09:00', '17:30', 30)).toBe(8);
    });

    it('matches the paper form: 11:00 AM to 9:00 PM is 10 hours', () => {
      expect(hoursBetween('11:00', '21:00', 0)).toBe(10);
    });

    it('reads an earlier end as an overnight shift', () => {
      expect(hoursBetween('22:00', '06:00', 0)).toBe(8);
    });

    it('is null until both times are valid', () => {
      expect(hoursBetween('09:00', '', 0)).toBeNull();
      expect(hoursBetween('9am', '17:00', 0)).toBeNull();
    });
  });

  describe('previewSheet', () => {
    const base = {
      startTime: null,
      endTime: null,
      breakMinutes: 0,
      hoursWorked: null,
      lineItems: [],
      hourlyRate: 50,
      isBillable: true,
    };

    it('prefers the span over typed hours, as the server does', () => {
      const preview = previewSheet({
        ...base,
        startTime: '09:00',
        endTime: '13:00',
        hoursWorked: 7,
      });
      expect(preview.hours).toBe(4);
      expect(preview.fromSpan).toBeTrue();
    });

    it('bills tasks at their own rate and the rest at the sheet rate', () => {
      const preview = previewSheet({
        ...base,
        hoursWorked: 8,
        lineItems: [{ hours: 2, rate: 80 }],
      });
      expect(preview.amount).toBe(2 * 80 + 6 * 50);
    });

    it('falls back to the task total when no hours are typed', () => {
      expect(previewSheet({ ...base, lineItems: [{ hours: 1.5, rate: null }] }).hours).toBe(1.5);
    });

    it('is worth nothing when not billable', () => {
      expect(previewSheet({ ...base, hoursWorked: 8, isBillable: false }).amount).toBe(0);
    });
  });

  describe('day keys', () => {
    it('parses as a local date so the day does not shift across time zones', () => {
      const date = parseDayKey('2026-08-06');
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(7);
      expect(date.getDate()).toBe(6);
    });

    it('rejects malformed keys', () => {
      expect(isDayKey('2026-8-6')).toBeFalse();
      expect(isDayKey(null)).toBeFalse();
      expect(isDayKey('2026-08-06')).toBeTrue();
    });
  });
});
