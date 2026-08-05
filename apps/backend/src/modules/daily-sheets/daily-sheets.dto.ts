import { z } from 'zod';

export const CreateDailySheetSchema = z.object({
  userId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  sheetDate: z.string().date(),
  hoursWorked: z.number().positive().max(24),
  hourlyRate: z.number().positive(),
  description: z.string().optional(),
  tasksCompleted: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(z.object({
    taskName: z.string(),
    description: z.string().optional(),
    hours: z.number().positive(),
    rate: z.number().positive().optional(),
  })).optional(),
});

export const UpdateDailySheetSchema = z.object({
  hoursWorked: z.number().positive().max(24).optional(),
  hourlyRate: z.number().positive().optional(),
  description: z.string().optional(),
  tasksCompleted: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(z.object({
    taskName: z.string(),
    description: z.string().optional(),
    hours: z.number().positive(),
    rate: z.number().positive().optional(),
  })).optional(),
});

export const ApproveDailySheetSchema = z.object({
  approved: z.boolean(),
  rejectionReason: z.string().optional(),
});

export const DailySheetQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
  page: z.number().default(1),
  pageSize: z.number().default(20),
});

export type CreateDailySheetDTO = z.infer<typeof CreateDailySheetSchema>;
export type UpdateDailySheetDTO = z.infer<typeof UpdateDailySheetSchema>;
export type ApproveDailySheetDTO = z.infer<typeof ApproveDailySheetSchema>;
export type DailySheetQueryDTO = z.infer<typeof DailySheetQuerySchema>;
