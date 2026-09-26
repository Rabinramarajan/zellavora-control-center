import { z } from 'zod';

/**
 * A monthly sheet is generated from the owner's approved daily sheets for
 * that month, so the client only names the month.
 */
export const CreateMonthlySheetSchema = z.object({
  /** Defaults to the caller; anyone else requires the review permission. */
  userId: z.string().uuid().optional(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

/** Regenerating takes no input: it re-reads the month's approved sheets. */
export const UpdateMonthlySheetSchema = z.object({}).strict();

export const ApproveMonthlySheetSchema = z
  .object({
    approved: z.boolean(),
    rejectionReason: z.string().trim().max(2000).optional(),
  })
  .refine((dto) => dto.approved || Boolean(dto.rejectionReason), {
    message: 'a reason is required to reject',
    path: ['rejectionReason'],
  });

export const MarkAsPaidSchema = z.object({
  paidAt: z.string().datetime().optional(),
});

/** Query strings arrive as text, so numbers are coerced before validation. */
export const MonthlySheetQuerySchema = z.object({
  /** `team` lists everyone's sheets and requires the review permission. */
  scope: z.enum(['mine', 'team']).default('mine'),
  userId: z.string().uuid().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'paid', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type CreateMonthlySheetDTO = z.infer<typeof CreateMonthlySheetSchema>;
export type ApproveMonthlySheetDTO = z.infer<typeof ApproveMonthlySheetSchema>;
export type MarkAsPaidDTO = z.infer<typeof MarkAsPaidSchema>;
export type MonthlySheetQueryDTO = z.infer<typeof MonthlySheetQuerySchema>;

export const MonthlyDocumentQuerySchema = z.object({
  /** Defaults to the caller; anyone else requires the review permission. */
  userId: z.string().uuid().optional(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

export type MonthlyDocumentQueryDTO = z.infer<typeof MonthlyDocumentQuerySchema>;
