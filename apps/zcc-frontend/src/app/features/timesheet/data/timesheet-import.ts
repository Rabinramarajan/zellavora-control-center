import { BulkEntryPatch, EntryStatus } from './timesheet.model';

export interface TimesheetImportPreview {
  entries: BulkEntryPatch[];
  errors: string[];
  sourcePeriod: string | null;
}

export type TimesheetImportFormat = 'csv' | 'json';

/** A checked file, kept with its text so exactly what was previewed is uploaded. */
export interface TimesheetImportFile extends TimesheetImportPreview {
  format: TimesheetImportFormat | null;
  content: string;
}

const MAX_FILE_BYTES = 1024 * 1024;
const TIME_PATTERN = /^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$|^([01]\d|2[0-3]):[0-5]\d$/i;
const STATUS_BY_LABEL: Record<string, EntryStatus> = {
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

export async function readTimesheetImport(
  file: File,
  expectedPeriod: string
): Promise<TimesheetImportFile> {
  const unreadable = (error: string): TimesheetImportFile => ({
    ...emptyPreview(error),
    format: null,
    content: '',
  });

  if (file.size === 0) return unreadable('The selected file is empty.');
  if (file.size > MAX_FILE_BYTES) return unreadable('The import file must be 1 MB or smaller.');

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'csv' && extension !== 'json') {
    return unreadable('Choose a CSV or JSON timesheet export.');
  }

  let content: string;
  try {
    content = (await file.text()).replace(/^\uFEFF/, '');
  } catch {
    return unreadable('The selected file could not be read.');
  }

  const preview =
    extension === 'json'
      ? parseJsonImport(content, expectedPeriod)
      : parseCsvImport(content, expectedPeriod);
  return { ...preview, format: extension, content };
}

export function parseCsvImport(text: string, expectedPeriod: string): TimesheetImportPreview {
  let records: string[][];
  try {
    records = parseCsv(text);
  } catch (error) {
    return emptyPreview((error as Error).message);
  }

  if (records.length < 2) return emptyPreview('The CSV does not contain any timesheet rows.');

  const headers = records[0].map((value) => value.trim().toLowerCase());
  const required = ['date', 'start', 'end', 'hours', 'status', 'notes'];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) return emptyPreview(`Missing CSV columns: ${missing.join(', ')}.`);

  const rows = records
    .slice(1)
    .map((record) =>
      Object.fromEntries(headers.map((header, index) => [header, record[index] ?? '']))
    );
  return validateRows(rows, expectedPeriod, null);
}

export function parseJsonImport(text: string, expectedPeriod: string): TimesheetImportPreview {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return emptyPreview('The JSON file is not valid JSON.');
  }

  const root = asRecord(parsed);
  const model = asRecord(root?.['data']) ?? root;
  const rows = model?.['rows'];
  if (!Array.isArray(rows)) {
    return emptyPreview('The JSON file does not contain a timesheet rows array.');
  }

  const sourcePeriod = typeof model?.['period'] === 'string' ? model['period'] : null;
  const records = rows.map(asRecord);
  if (records.some((row) => row === null)) return emptyPreview('Every JSON row must be an object.');
  return validateRows(records as RawRow[], expectedPeriod, sourcePeriod);
}

function validateRows(
  rows: RawRow[],
  expectedPeriod: string,
  sourcePeriod: string | null
): TimesheetImportPreview {
  const errors: string[] = [];
  const entries: BulkEntryPatch[] = [];
  const dates = new Set<string>();

  if (sourcePeriod && sourcePeriod !== expectedPeriod) {
    errors.push(`This file is for ${sourcePeriod}, but the open timesheet is ${expectedPeriod}.`);
  }
  if (rows.length === 0) errors.push('The import does not contain any timesheet rows.');
  if (rows.length > 31) errors.push('A timesheet import cannot contain more than 31 rows.');

  rows.slice(0, 31).forEach((row, index) => {
    const rowNumber = index + 2;
    const date = stringValue(row, 'date');
    const startTime = nullableString(row, 'startTime', 'start');
    const endTime = nullableString(row, 'endTime', 'end');
    const notes = nullableString(row, 'notes');
    const status = parseStatus(stringValue(row, 'status'));
    const hours = parseHours(row['hours']);

    if (!isCalendarDate(date)) {
      errors.push(`Row ${rowNumber}: date must be formatted as YYYY-MM-DD.`);
    } else {
      if (!date.startsWith(`${expectedPeriod}-`)) {
        errors.push(`Row ${rowNumber}: ${date} is outside ${expectedPeriod}.`);
      }
      if (dates.has(date)) {
        errors.push(`Row ${rowNumber}: ${date} appears more than once.`);
      }
    }
    dates.add(date);

    if (startTime && !TIME_PATTERN.test(startTime))
      errors.push(`Row ${rowNumber}: invalid start time.`);
    if (endTime && !TIME_PATTERN.test(endTime)) errors.push(`Row ${rowNumber}: invalid end time.`);
    if (hours === undefined) errors.push(`Row ${rowNumber}: hours must be between 0 and 24.`);
    if (!status) errors.push(`Row ${rowNumber}: unknown status.`);
    if ((notes?.length ?? 0) > 2000)
      errors.push(`Row ${rowNumber}: notes exceed 2,000 characters.`);

    if (status && hours !== undefined) {
      entries.push({ date, startTime, endTime, hours, status, notes });
    }
  });

  return { entries: errors.length ? [] : entries, errors, sourcePeriod };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
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
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (quoted) throw new Error('The CSV contains an unterminated quoted value.');
  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

function parseStatus(value: string): EntryStatus | null {
  const normalized = value.trim().toLowerCase();
  return STATUS_BY_LABEL[normalized] ?? null;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseHours(value: unknown): number | null | undefined {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 24 ? parsed : undefined;
}

function stringValue(row: RawRow, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return String(row[key]).trim();
  }
  return '';
}

function nullableString(row: RawRow, ...keys: string[]): string | null {
  return stringValue(row, ...keys) || null;
}

function asRecord(value: unknown): RawRow | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as RawRow)
    : null;
}

function emptyPreview(error: string): TimesheetImportPreview {
  return { entries: [], errors: [error], sourcePeriod: null };
}
