/**
 * Timesheet imports — the inverse of `timesheets.export.ts`.
 *
 * Accepts the CSV and JSON files that the export endpoint produces, so a
 * sheet can be round-tripped through a spreadsheet or restored from backup.
 * The browser parses the same file for an instant preview, but this module
 * is the authority: nothing reaches the database without passing here.
 *
 * Parsing is all-or-nothing. A file with any invalid row is rejected whole,
 * with one message per problem, rather than half-applied.
 */
import { z } from 'zod';
import { ClockTimeSchema, EntryStatusSchema } from './timesheets.dto';
import { isDateInPeriod } from './timesheets.calendar';

export type ImportFormat = 'csv' | 'json';

export interface ImportedEntry {
  date: string;
  startTime: string | null;
  endTime: string | null;
  hours: number | null;
  status: z.infer<typeof EntryStatusSchema>;
  notes: string | null;
}

export interface ImportParseResult {
  entries: ImportedEntry[];
  errors: string[];
}

export const MAX_IMPORT_ROWS = 31;
const MAX_NOTES_LENGTH = 2000;
const REQUIRED_CSV_COLUMNS = ['date', 'start', 'end', 'hours', 'status', 'notes'] as const;

/** Accepts the enum value and the human label the CSV export writes. */
const STATUS_BY_LABEL: Record<string, ImportedEntry['status']> = {
  '': 'EMPTY',
  '—': 'EMPTY',
  empty: 'EMPTY',
  working: 'WORKING',
  extended: 'EXTENDED',
  'weekend work': 'WEEKEND_WORK',
  weekend_work: 'WEEKEND_WORK',
  leave: 'LEAVE',
  holiday: 'HOLIDAY',
};

type RawRow = Record<string, unknown>;

export const parseTimesheetImport = (
  format: ImportFormat,
  content: string,
  period: string
): ImportParseResult => {
  const text = content.replace(/^\uFEFF/, '');
  return format === 'json' ? parseJson(text, period) : parseCsvImport(text, period);
};

const parseCsvImport = (text: string, period: string): ImportParseResult => {
  let records: string[][];
  try {
    records = parseCsv(text);
  } catch (error) {
    return failure((error as Error).message);
  }
  if (records.length < 2) return failure('The CSV does not contain any timesheet rows.');

  const headers = records[0].map((value) => value.trim().toLowerCase());
  const missing = REQUIRED_CSV_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length) return failure(`Missing CSV columns: ${missing.join(', ')}.`);

  const rows = records
    .slice(1)
    .map((record) => Object.fromEntries(headers.map((h, i) => [h, record[i] ?? ''])));
  return validateRows(rows, period, null);
};

const parseJson = (text: string, period: string): ImportParseResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return failure('The JSON file is not valid JSON.');
  }

  // Accept both the bare export model and the `{ success, data }` envelope.
  const root = asRecord(parsed);
  const model = asRecord(root?.['data']) ?? root;
  const rows = model?.['rows'];
  if (!Array.isArray(rows))
    return failure('The JSON file does not contain a timesheet rows array.');

  const sourcePeriod = typeof model?.['period'] === 'string' ? model['period'] : null;
  const records = rows.map(asRecord);
  if (records.some((row) => row === null)) return failure('Every JSON row must be an object.');
  return validateRows(records as RawRow[], period, sourcePeriod);
};

const validateRows = (
  rows: RawRow[],
  period: string,
  sourcePeriod: string | null
): ImportParseResult => {
  const errors: string[] = [];
  const entries: ImportedEntry[] = [];
  const seen = new Set<string>();

  if (sourcePeriod && sourcePeriod !== period) {
    errors.push(`This file is for ${sourcePeriod}, but the open timesheet is ${period}.`);
  }
  if (rows.length === 0) errors.push('The import does not contain any timesheet rows.');
  if (rows.length > MAX_IMPORT_ROWS) {
    errors.push(`A timesheet import cannot contain more than ${MAX_IMPORT_ROWS} rows.`);
  }

  rows.slice(0, MAX_IMPORT_ROWS).forEach((row, index) => {
    // Row 1 is the CSV header, so data starts at 2 — matching a spreadsheet.
    const label = `Row ${index + 2}`;
    const date = text(row, 'date');
    const startTime = nullableText(row, 'startTime', 'start');
    const endTime = nullableText(row, 'endTime', 'end');
    const notes = nullableText(row, 'notes');
    const status = STATUS_BY_LABEL[text(row, 'status').toLowerCase()] ?? null;
    const hours = parseHours(row['hours']);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`${label}: date must be formatted as YYYY-MM-DD.`);
    } else if (!isDateInPeriod(period, date)) {
      errors.push(`${label}: ${date} is outside ${period}.`);
    } else if (seen.has(date)) {
      errors.push(`${label}: ${date} appears more than once.`);
    }
    seen.add(date);

    if (startTime && !ClockTimeSchema.safeParse(startTime).success) {
      errors.push(`${label}: invalid start time.`);
    }
    if (endTime && !ClockTimeSchema.safeParse(endTime).success) {
      errors.push(`${label}: invalid end time.`);
    }
    if (hours === undefined) errors.push(`${label}: hours must be between 0 and 24.`);
    if (!status) errors.push(`${label}: unknown status.`);
    if ((notes?.length ?? 0) > MAX_NOTES_LENGTH) {
      errors.push(`${label}: notes exceed 2,000 characters.`);
    }

    if (status && hours !== undefined) {
      entries.push({ date, startTime, endTime, hours, status, notes });
    }
  });

  return errors.length ? { entries: [], errors } : { entries, errors };
};

/** RFC 4180: quoted cells, doubled quotes, CRLF or LF line endings. */
const parseCsv = (input: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  const endRow = (): void => {
    row.push(cell);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    row = [];
    cell = '';
  };

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      endRow();
    } else {
      cell += char;
    }
  }

  if (quoted) throw new Error('The CSV contains an unterminated quoted value.');
  endRow();
  return rows;
};

const parseHours = (value: unknown): number | null | undefined => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 24 ? parsed : undefined;
};

const text = (row: RawRow, ...keys: string[]): string => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return String(row[key]).trim();
  }
  return '';
};

const nullableText = (row: RawRow, ...keys: string[]): string | null => text(row, ...keys) || null;

const asRecord = (value: unknown): RawRow | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as RawRow) : null;

const failure = (error: string): ImportParseResult => ({ entries: [], errors: [error] });
