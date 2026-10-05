import { Prisma } from '@prisma/client';

/** Seller, client and bank details as frozen onto an issued invoice. */
export interface SellerSnapshot {
  name: string;
  addressLines: string[];
  pan: string | null;
  gstin: string | null;
  email: string | null;
  phone: string | null;
}

export interface ClientSnapshot {
  name: string;
  addressLines: string[];
  gstin: string | null;
  attnName: string | null;
  attnDesignation: string | null;
}

export interface BankSnapshot {
  accountName: string;
  bank: string;
  branch: string | null;
  accountNumber: string;
  ifsc: string;
}

/** Everything a renderer needs, already resolved: snapshots for issued, live data for drafts. */
export interface InvoiceRenderSource {
  invoiceNumber: string | null;
  status: string;
  invoiceDate: Date;
  dueDate: Date | null;
  periodLabel: string | null;
  taxRate: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  advance: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
  amountInWords: string;
  terms: string | null;
  footerNote: string | null;
  items: {
    slNo: number;
    description: string;
    note: string | null;
    qty: Prisma.Decimal;
    rate: Prisma.Decimal;
    amount: Prisma.Decimal;
  }[];
  seller: SellerSnapshot | null;
  client: ClientSnapshot;
  bank: BankSnapshot | null;
}

export interface InvoiceViewModel {
  number: string | null;
  dateText: string;
  dateKey: string;
  dueDateText: string | null;
  isDraft: boolean;
  isCancelled: boolean;
  seller: { name: string; addressLines: string[]; pan?: string; gstin?: string };
  client: { name: string; addressLines: string[]; gstin?: string; attn?: string };
  periodLabel?: string;
  items: {
    slNo: number;
    description: string;
    note?: string;
    qty: string;
    rate: string;
    value: string;
  }[];
  totals: {
    subtotal: string;
    tax?: { label: string; amount: string };
    advance: string;
    grand: string;
  };
  amountInWords: string;
  bank: {
    accountName: string;
    bank: string;
    branch?: string;
    accountNumber: string;
    ifsc: string;
  } | null;
  terms?: string;
  footerNote?: string;
}

/** Plain figures as on the paper bill: 60000, 1500.50; no grouping or symbol. */
export const formatMoney = (value: Prisma.Decimal.Value): string => {
  const amount = new Prisma.Decimal(value).toDecimalPlaces(2);
  return amount.isInteger() ? amount.toFixed(0) : amount.toFixed(2);
};

const formatQuantity = (value: Prisma.Decimal.Value): string =>
  new Prisma.Decimal(value).toDecimalPlaces(2).toString();

/** dd/MM/yyyy from a UTC-midnight date. */
export const formatDate = (date: Date): string => {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
};

const optional = (value: string | null | undefined): string | undefined => value || undefined;

const attnText = (client: ClientSnapshot): string | undefined => {
  if (!client.attnName) return undefined;
  return client.attnDesignation
    ? `${client.attnName} - ${client.attnDesignation}`
    : client.attnName;
};

export const splitLines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

export const buildInvoiceViewModel = (source: InvoiceRenderSource): InvoiceViewModel => {
  const taxRate = new Prisma.Decimal(source.taxRate);
  return {
    number: source.invoiceNumber,
    dateText: formatDate(source.invoiceDate),
    dateKey: source.invoiceDate.toISOString().slice(0, 10),
    dueDateText: source.dueDate ? formatDate(source.dueDate) : null,
    isDraft: source.status === 'DRAFT',
    isCancelled: source.status === 'CANCELLED',
    seller: {
      name: source.seller?.name ?? 'Set up your invoice profile',
      addressLines: source.seller?.addressLines ?? [],
      pan: optional(source.seller?.pan),
      gstin: optional(source.seller?.gstin),
    },
    client: {
      name: source.client.name,
      addressLines: source.client.addressLines,
      gstin: optional(source.client.gstin),
      attn: attnText(source.client),
    },
    periodLabel: optional(source.periodLabel),
    items: source.items.map((item) => ({
      slNo: item.slNo,
      description: item.description,
      note: optional(item.note),
      qty: formatQuantity(item.qty),
      rate: formatMoney(item.rate),
      value: formatMoney(item.amount),
    })),
    totals: {
      subtotal: formatMoney(source.subtotal),
      tax: taxRate.greaterThan(0)
        ? { label: `Tax @ ${taxRate.toString()}%`, amount: formatMoney(source.taxAmount) }
        : undefined,
      advance: formatMoney(source.advance),
      grand: formatMoney(source.grandTotal),
    },
    amountInWords: source.amountInWords,
    bank: source.bank
      ? {
          accountName: source.bank.accountName,
          bank: source.bank.bank,
          branch: optional(source.bank.branch),
          accountNumber: source.bank.accountNumber,
          ifsc: source.bank.ifsc,
        }
      : null,
    terms: optional(source.terms),
    footerNote: optional(source.footerNote),
  };
};

/** "Invoice_FY26-27-04_2026-10-05"; drafts use "Draft". */
export const invoiceFileName = (vm: InvoiceViewModel): string =>
  `Invoice_${(vm.number ?? 'Draft').replace(/[^A-Za-z0-9-]+/g, '-')}_${vm.dateKey}`;

/** Item rows on the bill, padded with blanks below the real lines. */
export const ITEM_AREA_ROWS = 4;
/** Blank rows between the totals and the signature note. */
export const TRAILING_BLANK_ROWS = 3;

/** The note above the bank block, starred as on the paper bill. */
export const footerText = (vm: InvoiceViewModel): string => {
  const note = vm.footerNote ?? 'Electronic bill signature not required';
  return note.startsWith('*') ? note : `*${note}`;
};
