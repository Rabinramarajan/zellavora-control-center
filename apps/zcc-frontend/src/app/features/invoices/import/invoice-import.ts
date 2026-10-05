/**
 * Reads an existing bill (PDF or Word) into fields the import form can show
 * for review. It is tuned to the "To, / Bill No / Sl.No … Value / Total /
 * Advance / Grand Total" layout but every field stays editable, so a bill it
 * cannot fully read still imports after correction.
 */

export interface ParsedInvoiceItem {
  description: string;
  note: string | null;
  qty: number;
  rate: number;
  amount: number;
}

export interface ParsedInvoice {
  invoiceNumber: string | null;
  /** "YYYY-MM-DD" */
  invoiceDate: string | null;
  client: {
    name: string | null;
    addressLines: string[];
    gstin: string | null;
    attnName: string | null;
    attnDesignation: string | null;
  };
  periodLabel: string | null;
  items: ParsedInvoiceItem[];
  subtotal: number | null;
  advance: number;
  grandTotal: number | null;
  /** Things the reviewer should check before saving. */
  warnings: string[];
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const AMOUNT = String.raw`(?:₹|Rs\.?|INR)?\s*(\d[\d,]*(?:\.\d{1,2})?)`;
const GSTIN = /\b(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/i;

const BILL_NO = /\b(?:Bill|Invoice)\s*(?:No|Number|#)\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]*)/i;
const DATE_NUMERIC = /\bDate\s*[:\-]?\s*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/i;
const DATE_WORDS =
  /\bDate\s*[:\-]?\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/i;
const PERIOD = /(For the month of\s+.+?)(?:\s{2,}|$)/i;
const ITEM_ROW = new RegExp(
  String.raw`^(\d{1,3})[.)]?\s+(.+?)\s+(\d[\d,]*(?:\.\d+)?)\s+${AMOUNT}\s+${AMOUNT}\s*$`,
  'i'
);
const ITEMS_HEADER = /\bSl\.?\s*No\b/i;
const TOTALS_START = /^(?:Sub\s*)?Total\b|^Grand\s*Total\b|^Amount\s+In\b/i;

const money = (text: string): number => Number(text.replace(/,/g, ''));

const pad = (value: number): string => String(value).padStart(2, '0');

const dateKey = (year: number, month: number, day: number): string | null => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${year}-${pad(month)}-${pad(day)}`
    : null;
};

/** Bills in India print dd/MM/yyyy, so the first number is the day. */
const findDate = (text: string): string | null => {
  const numeric = DATE_NUMERIC.exec(text);
  if (numeric) {
    const year = Number(numeric[3]) < 100 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    return dateKey(year, Number(numeric[2]), Number(numeric[1]));
  }
  const words = DATE_WORDS.exec(text);
  if (words) {
    const month = MONTHS.indexOf(words[2].slice(0, 3).toLowerCase()) + 1;
    return month ? dateKey(Number(words[3]), month, Number(words[1])) : null;
  }
  return null;
};

const labelledAmount = (lines: readonly string[], label: RegExp): number | null => {
  for (const line of lines) {
    const match = new RegExp(`${label.source}\\s*[:\\-]?\\s*${AMOUNT}`, 'i').exec(line);
    if (match) return money(match[1]);
  }
  return null;
};

/** Text with the bill number and date labels removed, for the address blocks. */
const stripHeaderLabels = (line: string): string =>
  line
    .replace(new RegExp(`${BILL_NO.source}`, 'i'), ' ')
    .replace(DATE_NUMERIC, ' ')
    .replace(DATE_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const readClient = (lines: readonly string[]): ParsedInvoice['client'] => {
  const client: ParsedInvoice['client'] = {
    name: null,
    addressLines: [],
    gstin: null,
    attnName: null,
    attnDesignation: null,
  };

  const attnLine = lines.find((line) => /\bAttn\b/i.test(line));
  if (attnLine) {
    const [name, ...designation] = attnLine
      .replace(/^.*?\bAttn\.?\s*[:\-]?\s*/i, '')
      .split(',')
      .map((part) => part.trim());
    client.attnName = name || null;
    client.attnDesignation = designation.join(', ') || null;
  }

  const start = lines.findIndex((line) => /^To\b[,:]?/i.test(line.trim()));
  if (start === -1) return client;

  const block: string[] = [];
  const first = stripHeaderLabels(lines[start].replace(/^\s*To\b[,:]?/i, ''));
  if (first) block.push(first);
  for (const raw of lines.slice(start + 1, start + 9)) {
    if (/\b(?:PAN|Attn|Sl\.?\s*No)\b/i.test(raw)) break;
    const gstin = /\bGST(?:IN)?\s*(?:No)?\.?/i.test(raw) ? GSTIN.exec(raw) : null;
    if (gstin) {
      client.gstin = gstin[1].toUpperCase();
      break;
    }
    const line = stripHeaderLabels(raw);
    if (line) block.push(line);
    // Without a GST line the address ends at the seller's block; cap it.
    if (block.length >= 5) break;
  }

  client.name = block[0] ?? null;
  client.addressLines = block.slice(1);
  return client;
};

const readItems = (
  lines: readonly string[]
): { items: ParsedInvoiceItem[]; periodLabel: string | null } => {
  const items: ParsedInvoiceItem[] = [];
  let periodLabel: string | null = null;
  const header = lines.findIndex((line) => ITEMS_HEADER.test(line));
  if (header === -1) return { items, periodLabel };

  for (const line of lines.slice(header + 1)) {
    if (TOTALS_START.test(line.trim())) break;
    const row = ITEM_ROW.exec(line.trim());
    if (row) {
      items.push({
        description: row[2].trim(),
        note: null,
        qty: money(row[3]),
        rate: money(row[4]),
        amount: money(row[5]),
      });
      continue;
    }
    const period = PERIOD.exec(line);
    if (period) {
      periodLabel = period[1].trim();
      continue;
    }
    // A wrapped description line belongs to the row above it.
    const last = items.at(-1);
    if (last && line.trim()) last.note = last.note ? `${last.note} ${line.trim()}` : line.trim();
  }
  return { items, periodLabel };
};

export const parseInvoiceLines = (rawLines: readonly string[]): ParsedInvoice => {
  const lines = rawLines.map((line) => line.replace(/ /g, ' ').trim()).filter(Boolean);
  const text = lines.join('\n');

  const { items, periodLabel: itemPeriod } = readItems(lines);
  const periodLabel = itemPeriod ?? PERIOD.exec(text)?.[1]?.trim() ?? null;
  const grandTotal = labelledAmount(lines, /Grand\s*Total/);
  const subtotal = labelledAmount(
    lines.filter((line) => !/Grand\s*Total/i.test(line)),
    /(?:Sub\s*)?Total/
  );
  const advance = labelledAmount(lines, /Advance/) ?? 0;

  const parsed: ParsedInvoice = {
    invoiceNumber: BILL_NO.exec(text)?.[1]?.toUpperCase() ?? null,
    invoiceDate: findDate(text),
    client: readClient(lines),
    periodLabel,
    items,
    subtotal,
    advance,
    grandTotal,
    warnings: [],
  };

  // A single-line bill with no readable row still has a total to bill.
  if (items.length === 0 && (subtotal ?? grandTotal)) {
    const amount = (subtotal ?? (grandTotal ?? 0) + advance) as number;
    parsed.items.push({
      description: 'Professional services',
      note: null,
      qty: 1,
      rate: amount,
      amount,
    });
    parsed.warnings.push('No item rows were found; one line was created from the total.');
  }

  const itemsTotal = parsed.items.reduce((sum, item) => sum + item.amount, 0);
  for (const item of parsed.items) {
    if (Math.abs(item.qty * item.rate - item.amount) > 0.5) {
      parsed.warnings.push(`"${item.description}": qty × rate does not equal the value printed.`);
    }
  }
  if (subtotal !== null && Math.abs(itemsTotal - subtotal) > 0.5) {
    parsed.warnings.push('The item values do not add up to the printed total.');
  }
  if (grandTotal !== null && Math.abs(itemsTotal - advance - grandTotal) > 0.5) {
    parsed.warnings.push('The printed grand total differs from total − advance; check for tax.');
  }
  if (!parsed.invoiceNumber) parsed.warnings.push('No bill number found.');
  if (!parsed.invoiceDate) parsed.warnings.push('No bill date found.');
  if (!parsed.client.name) parsed.warnings.push('No client ("To,") block found.');
  return parsed;
};

export type InvoiceFileKind = 'pdf' | 'docx';

export const invoiceFileKind = (file: File): InvoiceFileKind | null => {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  return null;
};

/** Read a bill file into review fields. The readers load only when used. */
export const readInvoiceFile = async (file: File): Promise<ParsedInvoice> => {
  const kind = invoiceFileKind(file);
  if (!kind) throw new Error('Only PDF and Word (.docx) bills can be imported.');
  if (kind === 'pdf') {
    const { readPdfLines, withTimeout } =
      await import('../../freelancer-sheets/import/timesheet-pdf');
    const lines = await withTimeout(readPdfLines(file), 20_000, 'The PDF took too long to read.');
    if (lines.length === 0) {
      throw new Error('This PDF has no text layer (it may be a scan), so it cannot be read.');
    }
    return parseInvoiceLines(lines);
  }
  const { readWordLines } = await import('../../timesheet/data/timesheet-import-documents');
  return parseInvoiceLines(await readWordLines(file));
};
