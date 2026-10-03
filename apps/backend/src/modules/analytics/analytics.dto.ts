import { z } from 'zod';

export const AnalyticsRangeSchema = z.enum(['7', '30', '90']).default('30');

export const AnalyticsOverviewQuerySchema = z.object({
  range: AnalyticsRangeSchema,
});

export const AnalyticsTopPagesQuerySchema = z.object({
  range: AnalyticsRangeSchema,
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const AnalyticsTopReferrersQuerySchema = z.object({
  range: AnalyticsRangeSchema,
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const AnalyticsGeoQuerySchema = z.object({
  range: AnalyticsRangeSchema,
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const AnalyticsDevicesQuerySchema = z.object({
  range: AnalyticsRangeSchema,
});

export const AnalyticsBrowsersQuerySchema = z.object({
  range: AnalyticsRangeSchema,
});

export const AnalyticsExportQuerySchema = z.object({
  range: AnalyticsRangeSchema,
  format: z.enum(['json', 'csv']).default('json'),
});

export type AnalyticsRange = z.infer<typeof AnalyticsRangeSchema>;
export type AnalyticsOverviewQuery = z.infer<typeof AnalyticsOverviewQuerySchema>;
export type AnalyticsTopPagesQuery = z.infer<typeof AnalyticsTopPagesQuerySchema>;
export type AnalyticsTopReferrersQuery = z.infer<typeof AnalyticsTopReferrersQuerySchema>;
export type AnalyticsGeoQuery = z.infer<typeof AnalyticsGeoQuerySchema>;
export type AnalyticsDevicesQuery = z.infer<typeof AnalyticsDevicesQuerySchema>;
export type AnalyticsBrowsersQuery = z.infer<typeof AnalyticsBrowsersQuerySchema>;
export type AnalyticsExportQuery = z.infer<typeof AnalyticsExportQuerySchema>;