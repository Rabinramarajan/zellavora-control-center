import { parseTimesheetLines } from './timesheet-pdf';

const AUGUST = [
  'TIMESHEET',
  'Employee: Rabin R Department: Development Period: Aug 1 - Aug 31, 2026 Total Hours: 190',
  'Date Day Start Time End Time Hours Status/Notes',
  'Aug 1 Sat',
  'Aug 2 Sun',
  'Aug 3 Mon 11:00 AM 9:00 PM 10 Working',
  'Aug 4 Tue 11:00 AM 9:00 PM 10 Working',
  'Aug 6 Thu - - LEAVE LEAVE',
  'Aug 7 Fri 11:00 AM 9:00 PM 10 Working',
  'Aug 8 Sat',
  'Aug 31 Mon 11:00 AM 9:00 PM 10 Working',
  'Summary',
  'Total Working Days 19 days',
];

describe('parseTimesheetLines', () => {
  it('reads the header fields', () => {
    const sheet = parseTimesheetLines(AUGUST);
    expect(sheet.employee).toBe('Rabin R');
    expect(sheet.department).toBe('Development');
    expect(sheet.period).toBe('Aug 1 - Aug 31, 2026');
    expect(sheet.declaredTotalHours).toBe(190);
  });

  it('converts work rows to 24-hour times with the stated hours', () => {
    const [first] = parseTimesheetLines(AUGUST).days;
    expect(first).toEqual({
      date: '2026-08-03',
      kind: 'work',
      startTime: '11:00',
      endTime: '21:00',
      hours: 10,
    });
  });

  it('marks leave rows and counts blank weekend rows separately', () => {
    const sheet = parseTimesheetLines(AUGUST);
    expect(sheet.days.find((day) => day.date === '2026-08-06')?.kind).toBe('leave');
    expect(sheet.days.length).toBe(5);
    expect(sheet.blankRows).toBe(3);
  });

  it('derives hours from the times when no hours column is present', () => {
    const [day] = parseTimesheetLines(['Period: Mar 2026', 'Mar 2 Mon 9:30 AM 6:00 PM']).days;
    expect(day.hours).toBe(8.5);
  });

  it('accepts 24-hour clocks and holidays', () => {
    const { days } = parseTimesheetLines([
      'Period: May 2026',
      'May 1 Fri Holiday',
      'May 4 Mon 08:00 16:00 8',
    ]);
    expect(days.map((day) => day.kind)).toEqual(['holiday', 'work']);
    expect(days[1].startTime).toBe('08:00');
  });

  it('splits years for a period crossing New Year', () => {
    const { days } = parseTimesheetLines([
      'Period: Dec 16, 2025 - Jan 15, 2026',
      'Dec 31 Wed 10:00 AM 6:00 PM 8',
      'Jan 2 Fri 10:00 AM 6:00 PM 8',
    ]);
    expect(days.map((day) => day.date)).toEqual(['2025-12-31', '2026-01-02']);
  });

  it('ignores impossible dates and duplicate rows', () => {
    const { days } = parseTimesheetLines([
      'Period: Feb 2026',
      'Feb 30 Mon 9:00 AM 5:00 PM 8',
      'Feb 2 Mon 9:00 AM 5:00 PM 8',
      'Feb 2 Mon 9:00 AM 1:00 PM 4',
    ]);
    expect(days.length).toBe(1);
    expect(days[0].hours).toBe(8);
  });
});
