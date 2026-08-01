import { z } from 'zod';

/** Valid dashboard time-range windows, expressed in days. */
export const DashboardRangeSchema = z.enum(['7', '30', '90']).default('30');

export const OverviewQuerySchema = z.object({
  range: DashboardRangeSchema,
});

export const ActivityQuerySchema = z.object({
  range: DashboardRangeSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().optional(),
  severity: z.enum(['debug', 'info', 'warning', 'error', 'critical']).optional(),
});

export type OverviewQuery = z.infer<typeof OverviewQuerySchema>;
export type ActivityQuery = z.infer<typeof ActivityQuerySchema>;
