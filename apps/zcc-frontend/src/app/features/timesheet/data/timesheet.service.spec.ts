import { applyPatch, computeTotals } from './timesheet.service';
import { EntryStatus, TimesheetEntry } from './timesheet.model';

const entry = (status: EntryStatus, hours: number | null): TimesheetEntry => ({
  id: `${status}-${hours}`,
  timesheetId: 'sheet-1',
  entryDate: '2026-08-03',
  dayOfWeek: 'Monday',
  startTime: '09:00',
  endTime: '17:00',
  hours,
  status,
  notes: null,
});

describe('timesheet totals', () => {
  it('sums hours and counts each kind of day', () => {
    const totals = computeTotals([
      entry('WORKING', 8),
      entry('EXTENDED', 9.5),
      entry('WEEKEND_WORK', 4),
      entry('LEAVE', null),
      entry('HOLIDAY', null),
      entry('EMPTY', null),
    ]);

    expect(totals).toEqual({
      totalHours: 21.5,
      workingDays: 3,
      leaveDays: 1,
      holidayDays: 1,
      extendedDays: 1,
      weekendWorkDays: 1,
    });
  });

  it('counts extended and weekend days as working days too', () => {
    const totals = computeTotals([entry('EXTENDED', 10), entry('WEEKEND_WORK', 5)]);
    expect(totals.workingDays).toBe(2);
    expect(totals.extendedDays).toBe(1);
    expect(totals.weekendWorkDays).toBe(1);
  });

  it('returns zeroes for an untouched month', () => {
    const totals = computeTotals(Array.from({ length: 31 }, () => entry('EMPTY', null)));
    expect(totals.totalHours).toBe(0);
    expect(totals.workingDays).toBe(0);
  });

  it('ignores null hours rather than treating them as zero-length work', () => {
    expect(computeTotals([entry('WORKING', null)]).totalHours).toBe(0);
  });
});

describe('applyPatch', () => {
  it('merges the patched fields', () => {
    const result = applyPatch(entry('WORKING', 8), { hours: 6, notes: 'Half day' });
    expect(result.hours).toBe(6);
    expect(result.notes).toBe('Half day');
    expect(result.status).toBe('WORKING');
  });

  (['LEAVE', 'HOLIDAY'] as EntryStatus[]).forEach((status) => {
    it(`clears hours and times for ${status}`, () => {
      const result = applyPatch(entry('WORKING', 8), { status });
      expect(result.hours).toBeNull();
      expect(result.startTime).toBeNull();
      expect(result.endTime).toBeNull();
    });
  });

  it('matches the server even when hours and a leave status arrive together', () => {
    const result = applyPatch(entry('WORKING', 8), { status: 'LEAVE', hours: 8 });
    expect(result.hours).toBeNull();
  });

  it('does not mutate the original row', () => {
    const original = entry('WORKING', 8);
    applyPatch(original, { status: 'LEAVE' });
    expect(original.hours).toBe(8);
  });
});
