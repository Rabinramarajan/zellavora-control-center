import { parseCsvImport, parseJsonImport, readTimesheetImport } from './timesheet-import';

describe('readTimesheetImport', () => {
  const csv = 'Date,Day,Start,End,Hours,Status,Notes\n2026-10-01,Thursday,09:00,17:30,8,Working,';

  it('keeps the checked text and format so the same bytes are uploaded', async () => {
    const file = new File([`\uFEFF${csv}`], 'october.csv', { type: 'text/csv' });

    const result = await readTimesheetImport(file, '2026-10');

    expect(result.errors).toEqual([]);
    expect(result.format).toBe('csv');
    expect(result.content).toBe(csv);
    expect(result.entries.length).toBe(1);
  });

  it('refuses other file types and empty files before reading them', async () => {
    const pdf = await readTimesheetImport(new File(['x'], 'sheet.pdf'), '2026-10');
    const empty = await readTimesheetImport(new File([], 'sheet.csv'), '2026-10');

    expect(pdf.errors).toEqual(['Choose a CSV or JSON timesheet export.']);
    expect(pdf.format).toBeNull();
    expect(empty.errors).toEqual(['The selected file is empty.']);
  });

  it('refuses JSON rows that are not objects', () => {
    expect(parseJsonImport('{"rows":[1]}', '2026-10').errors).toEqual([
      'Every JSON row must be an object.',
    ]);
  });
});

describe('timesheet import', () => {
  it('parses the CSV produced by the timesheet exporter', () => {
    const preview = parseCsvImport(
      'Date,Day,Start,End,Hours,Status,Notes\r\n2026-10-01,Thursday,09:00,17:30,8,Working,"Client, support"',
      '2026-10'
    );

    expect(preview.errors).toEqual([]);
    expect(preview.entries).toEqual([
      {
        date: '2026-10-01',
        startTime: '09:00',
        endTime: '17:30',
        hours: 8,
        status: 'WORKING',
        notes: 'Client, support',
      },
    ]);
  });

  it('parses the enveloped JSON produced by the export endpoint', () => {
    const preview = parseJsonImport(
      JSON.stringify({
        success: true,
        data: {
          period: '2026-10',
          rows: [
            {
              date: '2026-10-02',
              startTime: null,
              endTime: null,
              hours: null,
              status: 'LEAVE',
              notes: 'Annual leave',
            },
          ],
        },
      }),
      '2026-10'
    );

    expect(preview.errors).toEqual([]);
    expect(preview.entries[0]).toEqual(
      jasmine.objectContaining({ date: '2026-10-02', status: 'LEAVE' })
    );
  });

  it('rejects another period and duplicate dates without returning partial data', () => {
    const preview = parseCsvImport(
      'Date,Day,Start,End,Hours,Status,Notes\n2026-09-01,Tuesday,09:00,17:00,8,Working,One\n2026-09-01,Tuesday,09:00,17:00,8,Working,Two',
      '2026-10'
    );

    expect(preview.entries).toEqual([]);
    expect(preview.errors.length).toBe(3);
  });

  it('rejects calendar dates that roll into another month', () => {
    const preview = parseCsvImport(
      'Date,Day,Start,End,Hours,Status,Notes\n2026-10-32,Friday,09:00,17:00,8,Working,Invalid date',
      '2026-10'
    );

    expect(preview.entries).toEqual([]);
    expect(preview.errors).toContain('Row 2: date must be formatted as YYYY-MM-DD.');
  });
});
