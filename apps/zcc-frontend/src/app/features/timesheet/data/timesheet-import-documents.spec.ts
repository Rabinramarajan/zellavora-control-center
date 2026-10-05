import { documentToCsv, gridToCsv, pdfLinesToCsv } from './timesheet-import-documents';
import { parseCsvImport, readTimesheetImport } from './timesheet-import';

/** Builds a minimal zip; entries are deflated so the inflate path is exercised. */
async function zip(files: Record<string, string>): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const [name, text] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const raw = encoder.encode(text);
    const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const data = new Uint8Array(await new Response(stream).arrayBuffer());

    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, 8, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + 22);
  let cursor = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

const fileOf = (bytes: Uint8Array, name: string): File => new File([bytes as BlobPart], name);

const SHEET_NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const WORD_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

describe('gridToCsv', () => {
  it('finds a header row below a title block and maps column aliases', () => {
    const csv = gridToCsv([
      ['Monthly timesheet'],
      ['Employee', 'Ada'],
      ['Work date', 'Time in', 'Time out', 'Hrs', 'Remarks'],
      ['2026-10-01', '9:00:00 AM', '5:30 PM', '8 h', 'Release'],
      ['3 Oct 2026', '', '', '4', ''],
      ['Total', '', '', '12', ''],
    ]);

    const preview = parseCsvImport(csv, '2026-10');
    expect(preview.errors).toEqual([]);
    expect(preview.entries).toEqual([
      {
        date: '2026-10-01',
        startTime: '9:00 AM',
        endTime: '5:30 PM',
        hours: 8,
        status: 'WORKING',
        notes: 'Release',
      },
      // 3 October 2026 is a Saturday.
      {
        date: '2026-10-03',
        startTime: null,
        endTime: null,
        hours: 4,
        status: 'WEEKEND_WORK',
        notes: null,
      },
    ]);
  });

  it('converts Excel date serials and time fractions', () => {
    // 46296 = 2026-10-01; 0.375 = 09:00; 0.7291666 = 17:30.
    const csv = gridToCsv([
      ['Date', 'Start', 'End', 'Hours', 'Status'],
      [46296, 0.375, 0.7291666667, 8, 'Working'],
    ]);
    expect(parseCsvImport(csv, '2026-10').entries[0]).toEqual(
      jasmine.objectContaining({ date: '2026-10-01', startTime: '09:00', endTime: '17:30' })
    );
  });

  it('explains a missing header row', () => {
    expect(() => gridToCsv([['Name', 'Value']])).toThrowError(/No timesheet table was found/);
  });
});

describe('pdfLinesToCsv', () => {
  it('reads the printable Zellavora export', () => {
    const csv = pdfLinesToCsv([
      'Timesheet — 2026-10',
      'Date Day Start End Hours Status Notes',
      '2026-10-01 Thursday 11:00 AM 7:30 PM 8.50 Extended Client call, then deploy',
      '2026-10-02 Friday Leave',
      '2026-10-04 Sunday —',
      'Total hours 8.50',
    ]);

    const preview = parseCsvImport(csv, '2026-10');
    expect(preview.errors).toEqual([]);
    expect(preview.entries).toEqual([
      {
        date: '2026-10-01',
        startTime: '11:00 AM',
        endTime: '7:30 PM',
        hours: 8.5,
        status: 'EXTENDED',
        notes: 'Client call, then deploy',
      },
      {
        date: '2026-10-02',
        startTime: null,
        endTime: null,
        hours: null,
        status: 'LEAVE',
        notes: null,
      },
      {
        date: '2026-10-04',
        startTime: null,
        endTime: null,
        hours: null,
        status: 'EMPTY',
        notes: null,
      },
    ]);
  });

  it('falls back to month-name day rows', () => {
    const csv = pdfLinesToCsv([
      'Period: Oct 1, 2026 - Oct 31, 2026',
      'Oct 1 Thu 9:00 AM 5:00 PM 8',
      'Oct 2 Fri - - LEAVE LEAVE',
    ]);
    const preview = parseCsvImport(csv, '2026-10');
    expect(preview.errors).toEqual([]);
    expect(preview.entries.map((entry) => entry.status)).toEqual(['WORKING', 'LEAVE']);
  });

  it('explains a PDF with no readable rows', () => {
    expect(() => pdfLinesToCsv(['Scanned page'])).toThrowError(/No timesheet rows were found/);
  });
});

describe('documentToCsv', () => {
  it('reads the first worksheet of an Excel workbook', async () => {
    const bytes = await zip({
      'xl/workbook.xml': `<workbook ${SHEET_NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="October" sheetId="1" r:id="rId7"/></sheets></workbook>`,
      'xl/_rels/workbook.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId7" Target="worksheets/october.xml"/></Relationships>`,
      'xl/sharedStrings.xml': `<sst ${SHEET_NS}><si><t>Date</t></si><si><t>Hours</t></si><si><t>Status</t></si><si><r><t>Work</t></r><r><t>ing</t></r></si></sst>`,
      'xl/worksheets/october.xml': `<worksheet ${SHEET_NS}><sheetData>
        <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c><c r="D1" t="s"><v>2</v></c></row>
        <row r="2"><c r="A2"><v>46296</v></c><c r="C2"><v>7.5</v></c><c r="D2" t="s"><v>3</v></c></row>
        <row r="3"><c r="A3" t="inlineStr"><is><t>2026-10-05</t></is></c><c r="C3"><v>8</v></c></row>
      </sheetData></worksheet>`,
    });

    const result = await readTimesheetImport(fileOf(bytes, 'october.xlsx'), '2026-10');

    expect(result.errors).toEqual([]);
    expect(result.format).toBe('csv');
    expect(result.sourceFormat).toBe('xlsx');
    expect(result.entries).toEqual([
      jasmine.objectContaining({ date: '2026-10-01', hours: 7.5, status: 'WORKING' }),
      jasmine.objectContaining({ date: '2026-10-05', hours: 8, status: 'WORKING' }),
    ]);
  });

  it('reads the table in a Word document', async () => {
    const cell = (text: string): string => `<w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
    const row = (...cells: string[]): string => `<w:tr>${cells.map(cell).join('')}</w:tr>`;
    const bytes = await zip({
      'word/document.xml': `<w:document ${WORD_NS}><w:body>
        <w:p><w:r><w:t>October timesheet</w:t></w:r></w:p>
        <w:tbl>
          ${row('Date', 'Start', 'End', 'Hours', 'Status', 'Notes')}
          ${row('2026-10-01', '09:00', '17:00', '8', 'Working', 'Planning')}
          ${row('2026-10-02', '', '', '', 'Holiday', '')}
        </w:tbl>
      </w:body></w:document>`,
    });

    const csv = await documentToCsv(fileOf(bytes, 'october.docx'), 'docx');
    const preview = parseCsvImport(csv, '2026-10');

    expect(preview.errors).toEqual([]);
    expect(preview.entries).toEqual([
      jasmine.objectContaining({ date: '2026-10-01', status: 'WORKING', notes: 'Planning' }),
      jasmine.objectContaining({ date: '2026-10-02', status: 'HOLIDAY' }),
    ]);
  });

  it('reports a damaged Office file in plain words', async () => {
    const result = await readTimesheetImport(
      fileOf(new TextEncoder().encode('not a zip'), 'broken.xlsx'),
      '2026-10'
    );
    expect(result.errors[0]).toMatch(/could not be opened|could not be read/);
    expect(result.format).toBeNull();
  });

  it('asks for the modern format for legacy .xls and .doc files', async () => {
    const xls = await readTimesheetImport(new File(['x'], 'old.xls'), '2026-10');
    expect(xls.errors).toEqual(['Save the Excel file as .xlsx (Excel Workbook) and import that.']);
  });
});
