import { z } from 'zod';

export const CreateMonthlySheetSchema = z.object({
  userId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  dailySheetIds: z.array(z.string().uuid()),
});

export const UpdateMonthlySheetSchema = z.object({
  dailySheetIds: z.array(z.string().uuid()).optional(),
});

export const ApproveMonthlySheetSchema = z.object({
  approved: z.boolean(),
  rejectionReason: z.string().optional(),
});

export const MarkAsPaidSchema = z.object({
  paidAt: z.string().datetime().optional(),
});

export const MonthlySheetQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'paid', 'rejected']).optional(),
  page: z.number().default(1),
  pageSize: z.number().default(20),
});

export type CreateMonthlySheetDTO = z.infer<typeof CreateMonthlySheetSchema>;
export type UpdateMonthlySheetDTO = z.infer<typeof UpdateMonthlySheetSchema>;
export type ApproveMonthlySheetDTO = z.infer<typeof ApproveMonthlySheetSchema>;
export type MarkAsPaidDTO = z.infer<typeof MarkAsPaidSchema>;
export type MonthlySheetQueryDTO = z.infer<typeof MonthlySheetQuerySchema>;
