import { TimesheetWithEntries } from './timesheets.repository';
import { buildExportModel, toCsv } from './timesheets.export';
import { parseTimesheetImport } from './timesheets.import';

const CSV_HEADER = 'Date,Day,Start,End,Hours,Status,Notes';

describe('parseTimesheetImport', () => {
  describe('csv', () => {
    it('reads the rows the CSV export writes, including labels and quoted notes', () => {
      const csv = [
        CSV_HEADER,
        '2026-08-03,Monday,09:00,17:30,8,Working,"Release, then ""retro"""',
        '2026-08-08,Saturday,10:00,12:00,2,Weekend work,',
        '2026-08-10,Monday,,,,Leave,',
        '2026-08-11,Tuesday,,,,—,',
      ].join('\r\n');

      const result = parseTimesheetImport('csv', csv, '2026-08');

      expect(result.errors).toEqual([]);
      expect(result.entries).toEqual([
        {
          date: '2026-08-03',
          startTime: '09:00',
          endTime: '17:30',
          hours: 8,
          status: 'WORKING',
          notes: 'Release, then "retro"',
        },
        {
          date: '2026-08-08',
          startTime: '10:00',
          endTime: '12:00',
          hours: 2,
          status: 'WEEKEND_WORK',
          notes: null,
        },
        {
          date: '2026-08-10',
          startTime: null,
          endTime: null,
          hours: null,
          status: 'LEAVE',
          notes: null,
        },
        {
          date: '2026-08-11',
          startTime: null,
          endTime: null,
          hours: null,
          status: 'EMPTY',
          notes: null,
        },
      ]);
    });

    it('round-trips a sheet through the CSV export', () => {
      const model = buildExportModel({
        id: 'sheet-1',
        period: '2026-08',
        status: 'DRAFT',
        user: { id: 'u', fullName: 'Ada', email: 'a@example.com', jobTitle: null },
        approver: null,
        submittedAt: null,
        approvedAt: null,
        rejectedAt: null,
        rejectionReason: null,
        entries: [
          {
            entryDate: new Date('2026-08-03T00:00:00.000Z'),
            dayOfWeek: 'Monday',
            startTime: '11:00 AM',
            endTime: '7:30 PM',
            hours: 8.5,
            status: 'EXTENDED',
            notes: 'Line one\nline two',
          },
        ],
      } as unknown as TimesheetWithEntries);

      const result = parseTimesheetImport('csv', `\uFEFF${toCsv(model)}`, '2026-08');

      expect(result.errors).toEqual([]);
      expect(result.entries).toEqual([
        {
          date: '2026-08-03',
          startTime: '11:00 AM',
          endTime: '7:30 PM',
          hours: 8.5,
          status: 'EXTENDED',
          notes: 'Line one\nline two',
        },
      ]);
    });

    it('names missing columns', () => {
      const result = parseTimesheetImport('csv', 'Date,Hours\n2026-08-03,8', '2026-08');
      expect(result.errors).toEqual(['Missing CSV columns: start, end, status, notes.']);
    });

    it('rejects an unterminated quoted value', () => {
      const result = parseTimesheetImport('csv', `${CSV_HEADER}\n2026-08-03,,,,,"oops`, '2026-08');
      expect(result.errors).toEqual(['The CSV contains an unterminated quoted value.']);
    });

    it('reports every bad row and writes nothing', () => {
      const csv = [
        CSV_HEADER,
        '2026-08-03,Monday,25:00,17:30,8,Working,',
        '2026-09-01,Tuesday,,,,Working,',
        '2026-08-31,Monday,,,30,Napping,',
        '2026-08-31,Monday,,,1,Working,',
        '2026-02-30,,,,,Working,',
      ].join('\n');

      const result = parseTimesheetImport('csv', csv, '2026-08');

      expect(result.entries).toEqual([]);
      expect(result.errors).toEqual([
        'Row 2: invalid start time.',
        'Row 3: 2026-09-01 is outside 2026-08.',
        'Row 4: hours must be between 0 and 24.',
        'Row 4: unknown status.',
        'Row 5: 2026-08-31 appears more than once.',
        'Row 6: 2026-02-30 is outside 2026-08.',
      ]);
    });

    it('refuses a header-only file', () => {
      expect(parseTimesheetImport('csv', CSV_HEADER, '2026-08').errors).toEqual([
        'The CSV does not contain any timesheet rows.',
      ]);
    });
  });

  describe('json', () => {
    const row = {
      date: '2026-08-03',
      dayOfWeek: 'Monday',
      startTime: '09:00',
      endTime: '17:00',
      hours: 8,
      status: 'WORKING',
      notes: null,
    };

    it('accepts the bare export model and the API envelope', () => {
      const bare = parseTimesheetImport(
        'json',
        JSON.stringify({ period: '2026-08', rows: [row] }),
        '2026-08'
      );
      const envelope = parseTimesheetImport(
        'json',
        JSON.stringify({ success: true, data: { period: '2026-08', rows: [row] } }),
        '2026-08'
      );

      expect(bare.errors).toEqual([]);
      expect(envelope).toEqual(bare);
      expect(bare.entries[0]).toMatchObject({ date: '2026-08-03', hours: 8, status: 'WORKING' });
    });

    it('refuses a file exported for another month', () => {
      const result = parseTimesheetImport(
        'json',
        JSON.stringify({ period: '2026-07', rows: [{ ...row, date: '2026-07-01' }] }),
        '2026-08'
      );
      expect(result.errors[0]).toBe('This file is for 2026-07, but the open timesheet is 2026-08.');
    });

    it('refuses malformed JSON and missing rows', () => {
      expect(parseTimesheetImport('json', '{', '2026-08').errors).toEqual([
        'The JSON file is not valid JSON.',
      ]);
      expect(parseTimesheetImport('json', '{"period":"2026-08"}', '2026-08').errors).toEqual([
        'The JSON file does not contain a timesheet rows array.',
      ]);
      expect(parseTimesheetImport('json', '{"rows":[1]}', '2026-08').errors).toEqual([
        'Every JSON row must be an object.',
      ]);
    });

    it('caps the number of rows', () => {
      const rows = Array.from({ length: 32 }, () => row);
      const result = parseTimesheetImport('json', JSON.stringify({ rows }), '2026-08');
      expect(result.errors).toContain('A timesheet import cannot contain more than 31 rows.');
      expect(result.entries).toEqual([]);
    });
  });
});
