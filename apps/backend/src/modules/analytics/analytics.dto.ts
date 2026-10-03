import { z } from 'zod';

export const AnalyticsRangeSchema = z.enum(['7', '30', '90']).default('30');
const LimitSchema = z.coerce.number().int().min(1).max(50).default(10);

export const AnalyticsOverviewQuerySchema = z.object({ range: AnalyticsRangeSchema });
export const AnalyticsTopQuerySchema = z.object({
  range: AnalyticsRangeSchema,
  limit: LimitSchema,
});
export const AnalyticsDevicesQuerySchema = z.object({ range: AnalyticsRangeSchema });

export const AnalyticsExportQuerySchema = z.object({
  range: AnalyticsRangeSchema,
  format: z.enum(['json', 'csv']).default('csv'),
});

/** A page view (or custom event) reported by the client tracker. */
export const TrackEventSchema = z
  .object({
    // Client-generated ids: the session lives in sessionStorage, the visitor in localStorage.
    sessionId: z.string().uuid('Invalid session id'),
    visitorId: z
      .string()
      .min(8)
      .max(64)
      .regex(/^[A-Za-z0-9-]+$/, 'Invalid visitor id'),
    eventType: z.enum(['pageview', 'event']).default('pageview'),
    eventName: z.string().trim().max(100).optional(),
    path: z.string().trim().max(512).regex(/^\//, 'Path must start with /'),
    title: z.string().trim().max(200).optional(),
    referrer: z.string().trim().max(512).optional(),
  })
  .strict()
  .refine((e) => e.eventType === 'pageview' || !!e.eventName, {
    message: 'eventName is required for custom events',
    path: ['eventName'],
  });

export type AnalyticsRange = z.infer<typeof AnalyticsRangeSchema>;
export type TrackEventDto = z.infer<typeof TrackEventSchema>;
