import { z } from 'zod';

/** 24-hour wall clock, "HH:mm". */
const ClockSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be formatted as HH:mm');

const LineItemSchema = z.object({
  taskName: z.string().trim().min(1, 'task name is required').max(200),
  description: z.string().trim().max(2000).optional(),
  hours: z.number().positive().max(24),
  rate: z.number().min(0).max(100000).optional(),
});

/** Leave and holiday days record the absence, not hours. */
export const ENTRY_TYPES = ['work', 'leave', 'holiday'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

/** Fields shared by create and update; every one is optional here. */
const SheetFieldsShape = {
  entryType: z.enum(ENTRY_TYPES).optional(),
  projectId: z.string().uuid().nullable().optional(),
  /** Free text; the name shown on sheets and the monthly timesheet. */
  projectName: z.string().trim().max(200).nullable().optional(),
  startTime: ClockSchema.nullable().optional(),
  endTime: ClockSchema.nullable().optional(),
  breakMinutes: z.number().int().min(0).max(720).optional(),
  hoursWorked: z.number().positive().max(24).optional(),
  hourlyRate: z.number().min(0).max(100000).optional(),
  isBillable: z.boolean().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  tasksCompleted: z.string().trim().max(5000).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  lineItems: z.array(LineItemSchema).max(50).optional(),
};

const isWork = (dto: { entryType?: EntryType }): boolean => (dto.entryType ?? 'work') === 'work';

/** Start and end travel together: one without the other has no meaning. */
const timesArePaired = (dto: { startTime?: string | null; endTime?: string | null }): boolean =>
  !dto.startTime === !dto.endTime;

export const CreateDailySheetSchema = z
  .object({
    /** Defaults to the caller; anyone else requires the review permission. */
    userId: z.string().uuid().optional(),
    sheetDate: z.string().date(),
    ...SheetFieldsShape,
  })
  .refine(timesArePaired, { message: 'start and end time must both be set', path: ['endTime'] })
  .refine((dto) => !isWork(dto) || dto.hourlyRate !== undefined, {
    message: 'hourly rate is required for a work day',
    path: ['hourlyRate'],
  })
  .refine(
    (dto) => !isWork(dto) || Boolean(dto.hoursWorked || dto.startTime || dto.lineItems?.length),
    {
      message: 'enter the hours worked, a start and end time, or at least one task',
      path: ['hoursWorked'],
    }
  );

export const UpdateDailySheetSchema = z
  .object({ sheetDate: z.string().date().optional(), ...SheetFieldsShape })
  .refine(timesArePaired, { message: 'start and end time must both be set', path: ['endTime'] });

export const ApproveDailySheetSchema = z
  .object({
    approved: z.boolean(),
    rejectionReason: z.string().trim().max(2000).optional(),
  })
  .refine((dto) => dto.approved || Boolean(dto.rejectionReason), {
    message: 'a reason is required to reject',
    path: ['rejectionReason'],
  });

/** Query strings arrive as text, so numbers are coerced before validation. */
export const DailySheetQuerySchema = z.object({
  /** `team` lists everyone's sheets and requires the review permission. */
  scope: z.enum(['mine', 'team']).default('mine'),
  userId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
});

export type CreateDailySheetDTO = z.infer<typeof CreateDailySheetSchema>;
export type UpdateDailySheetDTO = z.infer<typeof UpdateDailySheetSchema>;
export type ApproveDailySheetDTO = z.infer<typeof ApproveDailySheetSchema>;
export type DailySheetQueryDTO = z.infer<typeof DailySheetQuerySchema>;
export type DailySheetLineItemDTO = z.infer<typeof LineItemSchema>;
