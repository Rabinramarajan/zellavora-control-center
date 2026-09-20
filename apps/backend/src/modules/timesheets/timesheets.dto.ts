import { z } from 'zod';

/** "YYYY-MM" — the period a timesheet covers. */
export const PeriodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'period must be formatted as YYYY-MM');

/** "YYYY-MM-DD" — a single calendar day inside a period. */
export const EntryDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be formatted as YYYY-MM-DD');

/** Free-form wall clock as typed by the user, e.g. "11:00 AM" or "09:30". */
export const ClockTimeSchema = z
  .string()
  .trim()
  .max(8)
  .regex(/^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$|^([01]\d|2[0-3]):[0-5]\d$/i, 'invalid time');

export const EntryStatusSchema = z.enum([
  'EMPTY',
  'WORKING',
  'EXTENDED',
  'WEEKEND_WORK',
  'LEAVE',
  'HOLIDAY',
]);

export const TimesheetStatusSchema = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']);

export const GetTimesheetQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  period: PeriodSchema,
});

/** Fields of an entry a client may change. `null` clears a value. */
const EntryPatchShape = {
  startTime: ClockTimeSchema.nullable().optional(),
  endTime: ClockTimeSchema.nullable().optional(),
  hours: z.coerce.number().min(0).max(24).nullable().optional(),
  status: EntryStatusSchema.optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
};

export const UpdateEntrySchema = z.object(EntryPatchShape);

export const BulkUpsertEntriesSchema = z.object({
  entries: z
    .array(z.object({ date: EntryDateSchema, ...EntryPatchShape }))
    .min(1)
    .max(31),
});

export const RejectTimesheetSchema = z.object({
  rejectionReason: z.string().trim().min(1).max(2000),
});

export const ExportQuerySchema = z.object({
  format: z.enum(['json', 'csv', 'html']).default('json'),
});

export const SummaryQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2000).max(2100),
});

export const ListTimesheetsQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  status: TimesheetStatusSchema.optional(),
});

export type GetTimesheetQueryDTO = z.infer<typeof GetTimesheetQuerySchema>;
export type UpdateEntryDTO = z.infer<typeof UpdateEntrySchema>;
export type BulkUpsertEntriesDTO = z.infer<typeof BulkUpsertEntriesSchema>;
export type RejectTimesheetDTO = z.infer<typeof RejectTimesheetSchema>;
export type ExportQueryDTO = z.infer<typeof ExportQuerySchema>;
export type SummaryQueryDTO = z.infer<typeof SummaryQuerySchema>;
export type ListTimesheetsQueryDTO = z.infer<typeof ListTimesheetsQuerySchema>;
