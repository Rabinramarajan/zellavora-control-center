import { DocumentDaily, buildMonthlyDocument, toTwelveHour } from './monthly-sheets.document';

const EMPLOYEE = { id: 'u-1', name: 'Rabin R', department: 'Development', jobTitle: null };

const work = (day: number, start = '11:00', end = '21:00', hours = 10): DocumentDaily => ({
  sheetDate: new Date(Date.UTC(2026, 7, day)),
  entryType: 'work',
  startTime: start,
  endTime: end,
  hoursWorked: hours,
  description: null,
});

const leave = (day: number): DocumentDaily => ({
  sheetDate: new Date(Date.UTC(2026, 7, day)),
  entryType: 'leave',
  startTime: null,
  endTime: null,
  hoursWorked: 0,
  description: null,
});

/** The August 2026 sheet the team signs: weekdays 11–9, leave on the 6th and 21st. */
const augustDailies = (): DocumentDaily[] => {
  const dailies: DocumentDaily[] = [];
  for (let day = 1; day <= 31; day++) {
    const weekday = new Date(Date.UTC(2026, 7, day)).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    dailies.push(day === 6 || day === 21 ? leave(day) : work(day));
  }
  return dailies;
};

const build = (dailies: DocumentDaily[]) =>
  buildMonthlyDocument({
    year: 2026,
    month: 8,
    employee: EMPLOYEE,
    dailies,
    monthly: null,
    pendingDailyCount: 0,
  });

describe('buildMonthlyDocument', () => {
  it('reproduces the August 2026 paper timesheet', () => {
    const doc = build(augustDailies());

    expect(doc.periodLabel).toBe('Aug 1 - Aug 31, 2026');
    expect(doc.rows).toHaveLength(31);
    expect(doc.totalHours).toBe(190);
    expect(doc.summary).toMatchObject({
      workingDays: 19,
      leaveDays: 2,
      leaveDates: ['Aug 6', 'Aug 21'],
      extendedDates: [],
      weekendWorkDates: [],
      totalHours: 190,
    });
    expect(doc.schedule).toEqual({ startTime: '11:00 AM', endTime: '9:00 PM', hours: 10 });
  });

  it('lays each day out like the form', () => {
    const doc = build(augustDailies());
    const byDate = new Map(doc.rows.map((row) => [row.dateLabel, row]));

    expect(byDate.get('Aug 1')).toMatchObject({
      day: 'Sat',
      isWeekend: true,
      kind: 'blank',
      hours: null,
    });
    expect(byDate.get('Aug 3')).toMatchObject({
      day: 'Mon',
      startTime: '11:00 AM',
      endTime: '9:00 PM',
      hours: 10,
      statusLabel: 'Working',
    });
    expect(byDate.get('Aug 6')).toMatchObject({
      kind: 'leave',
      statusLabel: 'LEAVE',
      startTime: null,
    });
  });

  it('flags days longer than the usual schedule as extended', () => {
    const doc = build([
      ...augustDailies().filter((d) => d.sheetDate.getUTCDate() !== 4),
      work(4, '11:00', '23:00', 12),
    ]);

    expect(doc.rows[3]).toMatchObject({
      dateLabel: 'Aug 4',
      kind: 'extended',
      statusLabel: 'Extended',
    });
    expect(doc.summary.extendedDates).toEqual(['Aug 4']);
  });

  it('marks work on a weekend', () => {
    const doc = build([...augustDailies(), work(8, '10:00', '14:00', 4)]);

    expect(doc.rows[7]).toMatchObject({ dateLabel: 'Aug 8', kind: 'weekend_work', hours: 4 });
    expect(doc.summary.weekendWorkDates).toEqual(['Aug 8']);
    expect(doc.summary.workingDays).toBe(20);
  });

  it('merges several entries on one day into one row', () => {
    const doc = build([work(3, '09:00', '12:00', 3), work(3, '13:00', '18:00', 5)]);

    expect(doc.rows[2]).toMatchObject({ startTime: '9:00 AM', endTime: '6:00 PM', hours: 8 });
  });

  it('is a preview until a monthly sheet has been submitted', () => {
    expect(build([]).status).toBe('preview');

    const submitted = buildMonthlyDocument({
      year: 2026,
      month: 8,
      employee: EMPLOYEE,
      dailies: [],
      monthly: {
        id: 'm-1',
        status: 'approved',
        submittedAt: new Date('2026-09-01T10:00:00Z'),
        approvedAt: new Date('2026-09-02T10:00:00Z'),
        approverName: 'Team Head',
        paidAt: null,
      },
      pendingDailyCount: 0,
    });
    expect(submitted.status).toBe('approved');
    expect(submitted.approvals.approverName).toBe('Team Head');
  });

  it('has no schedule for an empty month', () => {
    expect(build([]).schedule).toBeNull();
  });
});

describe('toTwelveHour', () => {
  it.each([
    ['00:00', '12:00 AM'],
    ['09:05', '9:05 AM'],
    ['12:30', '12:30 PM'],
    ['21:00', '9:00 PM'],
  ])('%s → %s', (input, expected) => {
    expect(toTwelveHour(input)).toBe(expected);
  });
});
