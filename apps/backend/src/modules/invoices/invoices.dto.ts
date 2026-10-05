import { z } from 'zod';

/**
 * The backend compiles without strictNullChecks, where Zod marks every output
 * field optional. Parsed values are complete, so the types say so.
 */
type Parsed<T> = { [K in keyof T]-?: T[K] extends (infer U)[] ? Parsed<U>[] : T[K] };

export const parse = <S extends z.ZodTypeAny>(schema: S, input: unknown): Parsed<z.output<S>> =>
  schema.parse(input) as Parsed<z.output<S>>;

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

type TextIn = z.ZodEffects<z.ZodTypeAny, string | null, unknown>;

const upper = (pattern: RegExp, label: string): z.ZodEffects<z.ZodTypeAny, string, unknown> =>
  z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => pattern.test(value), `not a valid ${label}`);

/** Empty strings from forms mean "not set". */
const optionalText = (max: number): TextIn =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

const optionalCode = (pattern: RegExp, label: string): TextIn =>
  z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value.toUpperCase() : null))
    .refine((value) => value === null || pattern.test(value), `not a valid ${label}`);

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const money = z.coerce.number().finite().min(0).max(9_999_999_999.99);

export const UpsertInvoiceProfileSchema = z.object({
  legalName: z.string().trim().min(1).max(200),
  addressLines: z.string().trim().min(1).max(1000),
  pan: optionalCode(PAN, 'PAN'),
  gstin: optionalCode(GSTIN, 'GSTIN'),
  email: z
    .string()
    .trim()
    .email()
    .max(200)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
  phone: optionalText(30),
  bankAccountName: z.string().trim().min(1).max(200),
  bankName: z.string().trim().min(1).max(200),
  bankBranch: optionalText(200),
  /** Omit to keep the stored number; it is never sent back in full. */
  bankAccountNumber: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z]{6,34}$/, 'not a valid account number')
    .optional(),
  ifsc: upper(IFSC, 'IFSC code'),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).default(7),
  defaultTerms: optionalText(4000),
  footerNote: optionalText(500),
});

export const InvoiceClientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  addressLines: z.string().trim().min(1).max(1000),
  gstin: optionalCode(GSTIN, 'GSTIN'),
  attnName: optionalText(200),
  attnDesignation: optionalText(200),
  email: z
    .string()
    .trim()
    .email()
    .max(200)
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
});

export const InvoiceItemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  note: optionalText(500),
  qty: z.coerce.number().finite().positive().max(99_999_999.99),
  rate: money,
});

export const SaveInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  invoiceDate: dateKey,
  dueDate: dateKey.optional().nullable(),
  periodLabel: optionalText(200),
  taxRate: z.coerce.number().finite().min(0).max(100).default(0),
  advance: money.default(0),
  terms: optionalText(4000),
  footerNote: optionalText(500),
  items: z.array(InvoiceItemSchema).min(1).max(100),
});

export const InvoiceQuerySchema = z.object({
  status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'CANCELLED']).optional(),
  clientId: z.string().uuid().optional(),
  from: dateKey.optional(),
  to: dateKey.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const FromMonthlySheetSchema = z.object({
  clientId: z.string().uuid(),
  /** Hourly bills hours × average rate; retainer bills the month's amount once. */
  billing: z.enum(['hourly', 'retainer']).default('retainer'),
  description: z.string().trim().min(1).max(500).default('Professional services'),
  invoiceDate: dateKey.optional(),
});

export const MarkPaidSchema = z.object({
  paidAt: z.string().datetime().optional(),
});

export const CancelInvoiceSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

export const ExportQuerySchema = z.object({
  format: z.enum(['html', 'pdf', 'docx', 'json']),
});

/** Capped so one request cannot tie up the server rendering hundreds of PDFs. */
export const BulkExportSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

export const RegisterQuerySchema = InvoiceQuerySchema.omit({ page: true, pageSize: true }).extend({
  format: z.literal('csv').default('csv'),
});

export type UpsertInvoiceProfileDTO = Parsed<z.infer<typeof UpsertInvoiceProfileSchema>>;
export type InvoiceClientDTO = Parsed<z.infer<typeof InvoiceClientSchema>>;
export type SaveInvoiceDTO = Parsed<z.infer<typeof SaveInvoiceSchema>>;
export type InvoiceQueryDTO = Parsed<z.infer<typeof InvoiceQuerySchema>>;
export type FromMonthlySheetDTO = Parsed<z.infer<typeof FromMonthlySheetSchema>>;
export type MarkPaidDTO = Parsed<z.infer<typeof MarkPaidSchema>>;
export type CancelInvoiceDTO = Parsed<z.infer<typeof CancelInvoiceSchema>>;
export type RegisterQueryDTO = Parsed<z.infer<typeof RegisterQuerySchema>>;
