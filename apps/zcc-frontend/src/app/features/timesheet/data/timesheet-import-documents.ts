/**
 * Turns Excel, Word and PDF timesheets into the CSV the importer already
 * understands, so every format shares one validator and one server endpoint.
 *
 * .xlsx and .docx are zip archives of XML. They are unpacked with the
 * browser's DecompressionStream and read with DOMParser, so no spreadsheet
 * or document library ships in the bundle. PDFs reuse the on-demand pdf.js
 * reader from the freelancer sheets feature.
 */
import {
  parseTimesheetLines,
  readPdfLines,
  withTimeout,
} from '../../freelancer-sheets/import/timesheet-pdf';

export type DocumentFormat = 'xlsx' | 'docx' | 'pdf';

type Column = 'date' | 'start' | 'end' | 'hours' | 'status' | 'notes';

const COLUMNS: readonly Column[] = ['date', 'start', 'end', 'hours', 'status', 'notes'];

/** Header spellings seen in exports, templates and hand-made sheets. */
const HEADER_ALIASES: Record<Column, readonly string[]> = {
  date: ['date', 'day date', 'work date', 'entry date'],
  start: ['start', 'start time', 'time in', 'in', 'from', 'clock in'],
  end: ['end', 'end time', 'time out', 'out', 'to', 'clock out'],
  hours: ['hours', 'hrs', 'total hours', 'hours worked', 'duration'],
  status: ['status', 'type', 'day type', 'attendance'],
  notes: ['notes', 'note', 'comments', 'comment', 'remarks', 'description', 'task', 'tasks'],
};

const STATUS_LABELS = ['weekend work', 'working', 'extended', 'leave', 'holiday', '—'];
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const PDF_READ_TIMEOUT_MS = 20_000;
const XML_MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** A problem worth showing the user as written. */
export class DocumentImportError extends Error {
  public override readonly name = 'DocumentImportError';
}

/**
 * Reads a document and returns CSV text with the canonical import columns.
 * Every failure surfaces as a DocumentImportError with a readable message.
 */
export async function documentToCsv(
  file: File,
  format: DocumentFormat,
  period: string
): Promise<string> {
  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    switch (format) {
      case 'xlsx':
        return gridToCsv(await readSpreadsheetGrid(buffer), period);
      case 'docx':
        return gridToCsv(await readWordGrid(buffer), period);
      case 'pdf':
        return pdfLinesToCsv(await withTimeout(readPdfLines(file), PDF_READ_TIMEOUT_MS, 'timeout'));
    }
  } catch (error) {
    if (error instanceof DocumentImportError) throw error;
    const label = { xlsx: 'Excel workbook', docx: 'Word document', pdf: 'PDF' }[format];
    throw new DocumentImportError(
      error instanceof Error && error.message === 'timeout'
        ? `The ${label} took too long to read. Try saving it again.`
        : `The ${label} could not be read. It may be damaged or password-protected.`
    );
  }
}

// ---------------------------------------------------------------------------
// Grids (Excel and Word tables)
// ---------------------------------------------------------------------------

type Cell = string | number;

/**
 * Finds the header row anywhere in the grid (sheets often start with a title
 * block) and rewrites the rows beneath it under the canonical column names.
 */
export function gridToCsv(grid: readonly Cell[][], period: string): string {
  const headerIndex = grid.findIndex((row) => {
    const columns = mapHeader(row);
    return columns.has('date') && (columns.has('hours') || columns.has('status'));
  });
  if (headerIndex === -1) {
    throw new DocumentImportError(
      'No timesheet table was found. The file needs a header row with Date and Hours or Status columns.'
    );
  }

  const columns = mapHeader(grid[headerIndex]);
  const records: string[][] = [];
  for (const row of grid.slice(headerIndex + 1)) {
    const value = (column: Column): Cell => {
      const index = columns.get(column);
      return index === undefined ? '' : (row[index] ?? '');
    };
    const date = toDateKey(value('date'), period);
    // Title rows, totals and signature lines below the table have no date.
    if (!date) continue;

    // Hand-made sheets often write "LEAVE" or "Holiday" across the time and
    // hours cells instead of using a status column.
    const marker = [value('hours'), value('start'), value('end')]
      .map(dayMarker)
      .find((found) => found !== null);
    const hours = marker ? '' : toHours(value('hours'));
    const rawStatus = String(value('status')).trim();
    const status = dayMarker(rawStatus) ?? rawStatus;
    records.push([
      date,
      marker ? '' : toClock(value('start')),
      marker ? '' : toClock(value('end')),
      hours,
      status || marker || inferStatus(status, hours, date),
      String(value('notes')).trim(),
    ]);
  }

  if (records.length === 0) {
    throw new DocumentImportError('The timesheet table has no dated rows.');
  }
  return toCsv(records);
}

function mapHeader(row: readonly Cell[]): Map<Column, number> {
  const columns = new Map<Column, number>();
  row.forEach((cell, index) => {
    const label = String(cell).trim().toLowerCase().replace(/\s+/g, ' ');
    const column = COLUMNS.find((name) => HEADER_ALIASES[name].includes(label));
    if (column && !columns.has(column)) columns.set(column, index);
  });
  return columns;
}

/** Excel stores dates as days since 1899-12-30; text dates are parsed as written. */
function toDateKey(value: Cell, period: string): string {
  if (typeof value === 'number') {
    if (value < 1 || value > 2_958_465) return '';
    return new Date(Math.round((value - 25569) * 86_400_000)).toISOString().slice(0, 10);
  }

  const text = value.trim();
  // Labels such as "Total" or "Signature" contain no digits and are not days.
  if (!/\d/.test(text)) return '';
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const [periodYear, periodMonth] = period.split('-').map(Number);
  // A bare day number in a monthly sheet means that day of the open month.
  if (/^\d{1,2}$/.test(text)) return dateKeyOf(periodYear, periodMonth, Number(text)) ?? text;

  // Month-name dates only ("3 Aug 2026", "Mon, Sep 1"); 03/08/2026 is ambiguous.
  // Parsed by hand: browsers fill a missing year with 2001.
  const cleaned = text
    .replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s*/i, '')
    .replace(/(\d)(st|nd|rd|th)\b/gi, '$1')
    .trim();
  const dayFirst = /^(\d{1,2})[\s./-]*([a-z]{3,})\.?(?:[\s,./-]+(\d{2}|\d{4}))?$/i.exec(cleaned);
  const monthFirst = /^([a-z]{3,})\.?[\s./-]*(\d{1,2})(?:[\s,./-]+(\d{2}|\d{4}))?$/i.exec(cleaned);
  const parts = dayFirst
    ? { day: dayFirst[1], month: dayFirst[2], year: dayFirst[3] }
    : monthFirst
      ? { day: monthFirst[2], month: monthFirst[1], year: monthFirst[3] }
      : null;
  if (!parts) return text;

  const month = MONTH_NAMES.indexOf(parts.month.slice(0, 3).toLowerCase()) + 1;
  if (month === 0) return text;
  const year = !parts.year
    ? periodYear
    : parts.year.length === 2
      ? 2000 + Number(parts.year)
      : Number(parts.year);
  return dateKeyOf(year, month, Number(parts.day)) ?? text;
}

const MONTH_NAMES = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

/** "YYYY-MM-DD", or null when the day does not exist in that month. */
function dateKeyOf(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** Excel stores a time of day as a fraction of 24 hours. */
function toClock(value: Cell): string {
  if (typeof value === 'number') {
    if (value < 0 || value >= 1) return String(value);
    const minutes = Math.round(value * 1440);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
  const text = value.trim();
  if (text === '-' || text === '—') return '';
  // "9:00:00 AM" → "9:00 AM": the importer accepts minutes, not seconds.
  return text.replace(/^(\d{1,2}:\d{2}):\d{2}/, '$1');
}

function toHours(value: Cell): string {
  if (typeof value === 'number') return String(Math.round(value * 100) / 100);
  const text = value.trim();
  if (text === '-' || text === '—') return '';

  // Durations written as a clock or in words: "8:30", "8h 30m", "7 hrs 45 mins".
  const duration =
    /^(\d{1,2}):([0-5]\d)(?::\d{2})?$/.exec(text) ??
    /^(\d{1,2})\s*h(?:rs?|ours?)?\s*(?:([0-5]?\d)\s*m(?:ins?|inutes?)?)?$/i.exec(text);
  if (duration) {
    const hours = Number(duration[1]) + Number(duration[2] ?? 0) / 60;
    return String(Math.round(hours * 100) / 100);
  }
  return text.replace(/\s*(h|hrs?|hours?)$/i, '').replace(',', '.');
}

/** Words that stand in for hours on a non-working day, mapped to a status label. */
const DAY_MARKERS: readonly [RegExp, string][] = [
  [/^(leave|on leave|annual leave|sick( leave)?|pto|vacation|l)$/i, 'Leave'],
  [/^(holiday|public holiday|bank holiday|ph|h)$/i, 'Holiday'],
];

/** The status a marker word implies, or null when the cell is not a marker. */
function dayMarker(value: Cell): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return DAY_MARKERS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

/** Hand-made sheets often skip the status; hours on a day mean it was worked. */
function inferStatus(status: string, hours: string, date: string): string {
  if (status) return status;
  if (!hours || Number(hours) <= 0) return '';
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6 ? 'Weekend work' : 'Working';
}

function toCsv(records: readonly string[][]): string {
  const cell = (value: string): string =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const header = 'Date,Start,End,Hours,Status,Notes';
  return [header, ...records.map((record) => record.map(cell).join(','))].join('\r\n');
}

// ---------------------------------------------------------------------------
// Excel (.xlsx)
// ---------------------------------------------------------------------------

async function readSpreadsheetGrid(buffer: Uint8Array): Promise<Cell[][]> {
  const zip = await readZip(buffer, 'Excel workbook');
  const sharedStrings = zip.has('xl/sharedStrings.xml')
    ? [
        ...xml(await zip.text('xl/sharedStrings.xml')).getElementsByTagNameNS(XML_MAIN_NS, 'si'),
      ].map((item) => textOf(item, XML_MAIN_NS, 't'))
    : [];

  const sheetPath = await firstSheetPath(zip);
  const sheet = xml(await zip.text(sheetPath));
  const grid: Cell[][] = [];

  for (const row of sheet.getElementsByTagNameNS(XML_MAIN_NS, 'row')) {
    const cells: Cell[] = [];
    let nextColumn = 0;
    for (const cell of row.getElementsByTagNameNS(XML_MAIN_NS, 'c')) {
      const ref = cell.getAttribute('r');
      const column = ref ? columnIndex(ref) : nextColumn;
      nextColumn = column + 1;
      cells[column] = cellValue(cell, sharedStrings);
    }
    grid.push(Array.from(cells, (value) => value ?? ''));
  }
  return grid;
}

/** The first sheet in tab order, resolved through the workbook relationships. */
async function firstSheetPath(zip: ZipArchive): Promise<string> {
  const fallback = 'xl/worksheets/sheet1.xml';
  if (!zip.has('xl/workbook.xml') || !zip.has('xl/_rels/workbook.xml.rels')) {
    if (zip.has(fallback)) return fallback;
    throw new DocumentImportError('The Excel workbook does not contain a worksheet.');
  }

  const sheet = xml(await zip.text('xl/workbook.xml')).getElementsByTagNameNS(
    XML_MAIN_NS,
    'sheet'
  )[0];
  const relationId = sheet?.getAttributeNS(REL_NS, 'id');
  const relations = xml(await zip.text('xl/_rels/workbook.xml.rels')).getElementsByTagName(
    'Relationship'
  );
  const target = [...relations]
    .find((relation) => relation.getAttribute('Id') === relationId)
    ?.getAttribute('Target');
  if (!target) return fallback;
  return target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
}

function cellValue(cell: Element, sharedStrings: readonly string[]): Cell {
  const type = cell.getAttribute('t');
  const raw = cell.getElementsByTagNameNS(XML_MAIN_NS, 'v')[0]?.textContent ?? '';
  switch (type) {
    case 's':
      return sharedStrings[Number(raw)] ?? '';
    case 'inlineStr':
      return textOf(cell, XML_MAIN_NS, 't');
    case 'str':
    case 'e':
      return raw;
    case 'b':
      return raw === '1' ? 'TRUE' : 'FALSE';
    default:
      return raw === '' ? '' : Number(raw);
  }
}

/** "AB12" → 27 (zero-based). */
function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? 'A';
  return [...letters].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

// ---------------------------------------------------------------------------
// Word (.docx)
// ---------------------------------------------------------------------------

async function readWordGrid(buffer: Uint8Array): Promise<Cell[][]> {
  const zip = await readZip(buffer, 'Word document');
  if (!zip.has('word/document.xml')) {
    throw new DocumentImportError('The Word file does not contain a document body.');
  }

  const document = xml(await zip.text('word/document.xml'));
  const grid: Cell[][] = [];
  for (const row of document.getElementsByTagNameNS(WORD_NS, 'tr')) {
    const cells = [...row.getElementsByTagNameNS(WORD_NS, 'tc')].map((cell) =>
      [...cell.getElementsByTagNameNS(WORD_NS, 'p')]
        .map((paragraph) => textOf(paragraph, WORD_NS, 't'))
        .filter(Boolean)
        .join(' ')
    );
    grid.push(cells);
  }
  if (grid.length === 0) {
    throw new DocumentImportError('The Word document has no table. Put the timesheet in a table.');
  }
  return grid;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const ISO_ROW = new RegExp(
  `^(\\d{4}-\\d{2}-\\d{2})\\s+(?:(?:${DAY_NAMES.join('|')})\\b\\s*)?(.*)$`,
  'i'
);
const CLOCK_PREFIX = /^(\d{1,2}:\d{2}(?:\s?[AP]M)?)\s*/i;
const HOURS_PREFIX = /^(\d{1,2}(?:\.\d+)?)(?:\s+|$)/;

/**
 * Reads the printable Zellavora export ("2026-08-03 Monday 09:00 17:30 8.00
 * Working Notes…"). Other one-row-per-day layouts ("Aug 3 Mon 11:00 AM …")
 * fall back to the freelancer sheet reader.
 */
export function pdfLinesToCsv(lines: readonly string[]): string {
  const records: string[][] = [];
  for (const line of lines) {
    const match = ISO_ROW.exec(line.trim());
    if (match) records.push(parseIsoLine(match[1], match[2]));
  }

  if (records.length === 0) {
    const parsed = parseTimesheetLines(lines);
    for (const day of parsed.days) {
      const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay();
      const status =
        day.kind === 'leave'
          ? 'Leave'
          : day.kind === 'holiday'
            ? 'Holiday'
            : weekday === 0 || weekday === 6
              ? 'Weekend work'
              : 'Working';
      records.push([
        day.date,
        day.startTime ?? '',
        day.endTime ?? '',
        day.hours === null ? '' : String(day.hours),
        status,
        '',
      ]);
    }
  }

  if (records.length === 0) {
    throw new DocumentImportError(
      'No timesheet rows were found in the PDF. Scanned images cannot be read; use a PDF with selectable text.'
    );
  }
  return toCsv(records);
}

function parseIsoLine(date: string, rest: string): string[] {
  let remaining = rest.trim();
  const clocks: string[] = [];
  for (let i = 0; i < 2; i++) {
    const clock = CLOCK_PREFIX.exec(remaining);
    if (!clock) break;
    clocks.push(clock[1]);
    remaining = remaining.slice(clock[0].length);
  }

  const hoursMatch = HOURS_PREFIX.exec(remaining);
  const hours = hoursMatch?.[1] ?? '';
  if (hoursMatch) remaining = remaining.slice(hoursMatch[0].length);

  const lower = remaining.toLowerCase();
  const label = STATUS_LABELS.find(
    (candidate) => lower === candidate || lower.startsWith(`${candidate} `)
  );
  const status = label ? remaining.slice(0, label.length) : '';
  const notes = label ? remaining.slice(label.length).trim() : remaining;

  return [date, clocks[0] ?? '', clocks[1] ?? '', hours, inferStatus(status, hours, date), notes];
}

// ---------------------------------------------------------------------------
// Zip and XML plumbing
// ---------------------------------------------------------------------------

interface ZipArchive {
  has(path: string): boolean;
  text(path: string): Promise<string>;
}

/** Reads the central directory of a zip file; entries are inflated on demand. */
async function readZip(buffer: Uint8Array, kind: string): Promise<ZipArchive> {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const invalid = new DocumentImportError(
    `The ${kind} could not be opened. Save it again in the current Office format and retry.`
  );

  // The end-of-central-directory record sits in the last 64 KB (plus its own 22 bytes).
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end === -1) throw invalid;

  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const entries = new Map<string, { method: number; size: number; local: number }>();
  const decoder = new TextDecoder();

  for (let i = 0; i < count; i++) {
    if (offset + 46 > buffer.length || view.getUint32(offset, true) !== 0x02014b50) throw invalid;
    const nameLength = view.getUint16(offset + 28, true);
    const name = decoder.decode(buffer.subarray(offset + 46, offset + 46 + nameLength));
    entries.set(name, {
      method: view.getUint16(offset + 10, true),
      size: view.getUint32(offset + 20, true),
      local: view.getUint32(offset + 42, true),
    });
    offset +=
      46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }

  return {
    has: (path) => entries.has(path),
    async text(path) {
      const entry = entries.get(path);
      if (!entry || view.getUint32(entry.local, true) !== 0x04034b50) throw invalid;
      const start =
        entry.local +
        30 +
        view.getUint16(entry.local + 26, true) +
        view.getUint16(entry.local + 28, true);
      const data = buffer.subarray(start, start + entry.size);
      if (entry.method === 0) return decoder.decode(data);
      if (entry.method !== 8) throw invalid;
      const stream = new Blob([data as BlobPart])
        .stream()
        .pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).text();
    },
  };
}

function xml(text: string): Document {
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) {
    throw new DocumentImportError('The file contains damaged XML and could not be read.');
  }
  return document;
}

function textOf(element: Element, namespace: string, tag: string): string {
  return [...element.getElementsByTagNameNS(namespace, tag)]
    .map((node) => node.textContent ?? '')
    .join('');
}
