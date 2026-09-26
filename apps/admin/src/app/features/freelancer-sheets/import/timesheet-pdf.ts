import { hoursBetween } from '../sheets.time';

export type ImportedDayKind = 'work' | 'leave' | 'holiday';

export interface ImportedDay {
  /** "YYYY-MM-DD" */
  readonly date: string;
  readonly kind: ImportedDayKind;
  /** "HH:mm", 24-hour. */
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly hours: number | null;
}

export interface ParsedTimesheet {
  readonly employee: string | null;
  readonly department: string | null;
  readonly period: string | null;
  readonly declaredTotalHours: number | null;
  readonly days: readonly ImportedDay[];
  /** Date rows with nothing logged (weekends, blank days). */
  readonly blankRows: number;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const ROW =
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\s+(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\b(.*)$/i;
const CLOCK = /(\d{1,2}):(\d{2})(?:\s*([ap])\.?\s*m\.?)?/gi;
const HEADER_LABELS = 'Employee|Department|Period|Total Hours';

const pad = (value: number): string => String(value).padStart(2, '0');

const headerField = (text: string, label: string): string | null => {
  const match = new RegExp(`${label}:\\s*(.+?)\\s*(?=(?:${HEADER_LABELS}):|$)`, 'im').exec(text);
  return match?.[1]?.trim() || null;
};

const to24h = (hour: number, minute: number, meridiem: string | undefined): string | null => {
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridiem.toLowerCase() === 'p' ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }
  return `${pad(hour)}:${pad(minute)}`;
};

/**
 * Picks the year for each month. A period like "Dec 16, 2025 - Jan 15, 2026"
 * spans two years, so months at or after the first month take the first year.
 */
const yearResolver = (period: string | null, fullText: string): ((month: number) => number) => {
  const years = [...(period ?? '').matchAll(/\b(?:19|20)\d{2}\b/g)].map((m) => Number(m[0]));
  const fallback = /\b(?:19|20)\d{2}\b/.exec(fullText);
  const endYear = years.at(-1) ?? (fallback ? Number(fallback[0]) : new Date().getFullYear());
  const startYear = years[0] ?? endYear;
  if (startYear === endYear) return () => endYear;
  const startMonthMatch = /^\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.exec(
    period ?? ''
  );
  const startMonth = startMonthMatch ? MONTHS.indexOf(startMonthMatch[1].toLowerCase()) : 0;
  return (month) => (month >= startMonth ? startYear : endYear);
};

const parseRowBody = (body: string): Omit<ImportedDay, 'date'> | null => {
  if (/\bholiday\b/i.test(body)) {
    return { kind: 'holiday', startTime: null, endTime: null, hours: null };
  }
  if (/\bleave\b/i.test(body)) {
    return { kind: 'leave', startTime: null, endTime: null, hours: null };
  }

  const clocks = [...body.matchAll(CLOCK)];
  const times = clocks
    .map((m) => to24h(Number(m[1]), Number(m[2]), m[3]))
    .filter((time): time is string => time !== null);
  const rest = clocks.reduce((text, m) => text.replace(m[0], ' '), body);
  const hoursMatch = /(?:^|\s)(\d{1,2}(?:\.\d+)?)(?=\s|h\b|$)/i.exec(rest);
  const statedHours = hoursMatch ? Number(hoursMatch[1]) : null;

  const [startTime, endTime] = times.length >= 2 ? times : [null, null];
  const hours =
    statedHours && statedHours > 0 && statedHours <= 24
      ? statedHours
      : startTime && endTime
        ? hoursBetween(startTime, endTime, 0)
        : null;

  if (!hours) return null;
  return { kind: 'work', startTime, endTime, hours };
};

/**
 * Reads a timesheet laid out as one row per day — "Aug 3 Mon 11:00 AM 9:00 PM 10 Working",
 * "Aug 6 Thu - - LEAVE LEAVE" — with an optional "Employee: … Period: …" header.
 * Rows with no times, hours or leave marker (weekends) are counted, not returned.
 */
export const parseTimesheetLines = (lines: readonly string[]): ParsedTimesheet => {
  const text = lines.join('\n');
  const period = headerField(text, 'Period');
  const yearFor = yearResolver(period, text);
  const declared = headerField(text, 'Total Hours');

  const days = new Map<string, ImportedDay>();
  let blankRows = 0;

  for (const line of lines) {
    const match = ROW.exec(line.trim());
    if (!match) continue;
    const month = MONTHS.indexOf(match[1].slice(0, 3).toLowerCase());
    const day = Number(match[2]);
    const year = yearFor(month);
    const probe = new Date(year, month, day);
    if (probe.getMonth() !== month || probe.getDate() !== day) continue;

    const date = `${year}-${pad(month + 1)}-${pad(day)}`;
    const body = parseRowBody(match[3]);
    if (!body) {
      blankRows++;
      continue;
    }
    if (!days.has(date)) days.set(date, { date, ...body });
  }

  return {
    employee: headerField(text, 'Employee'),
    department: headerField(text, 'Department'),
    period,
    declaredTotalHours: declared && /^\d+(\.\d+)?/.test(declared) ? parseFloat(declared) : null,
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    blankRows,
  };
};

interface PositionedText {
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

/** Items whose baselines sit this close (PDF units) are on the same visual row. */
const ROW_TOLERANCE = 3;

const groupIntoLines = (items: readonly PositionedText[]): string[] => {
  const rows: { y: number; items: PositionedText[] }[] = [];
  for (const item of [...items].sort((a, b) => b.y - a.y)) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= ROW_TOLERANCE);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  return rows.map((row) =>
    row.items
      .sort((a, b) => a.x - b.x)
      .map((item) => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
};

/**
 * zone.js replaces the global Promise with ZoneAwarePromise, which lacks the
 * ES2025 `Promise.try` that pdf.js calls inside its message handler. There the
 * TypeError is swallowed, nothing settles, and loading hangs forever.
 */
const ensurePromiseTry = (): void => {
  const ctor = Promise as PromiseConstructor & { try?: unknown };
  if (typeof ctor.try === 'function') return;
  Object.defineProperty(ctor, 'try', {
    configurable: true,
    writable: true,
    value<T>(
      this: PromiseConstructor,
      fn: (...args: unknown[]) => T | PromiseLike<T>,
      ...args: unknown[]
    ): Promise<T> {
      // A synchronous throw inside the executor rejects the promise, as the spec requires.
      return new this<T>((resolve) => resolve(fn(...args)));
    },
  });
};

/** Rejects with `message` if `work` has not settled within `ms`. */
export const withTimeout = <T>(work: Promise<T>, ms: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

/**
 * Extracts the text of a PDF as visual lines. pdf.js is loaded on demand so it
 * stays out of the main bundle; its worker runs in-thread, which is fine for a
 * one- or two-page timesheet and avoids serving a separate worker asset.
 */
export const readPdfLines = async (file: File): Promise<string[]> => {
  ensurePromiseTry();
  // Importing the worker module registers `globalThis.pdfjsWorker`, which
  // pdf.js picks up instead of spawning a Worker from `workerSrc`.
  const [pdfjs] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs'),
  ]);

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  try {
    const lines: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const items: PositionedText[] = [];
      for (const item of content.items) {
        if ('str' in item && item.str.trim()) {
          items.push({ text: item.str, x: item.transform[4], y: item.transform[5] });
        }
      }
      lines.push(...groupIntoLines(items));
    }
    return lines;
  } finally {
    void task.destroy();
  }
};
