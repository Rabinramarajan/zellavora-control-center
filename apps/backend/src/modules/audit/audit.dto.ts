import { z } from 'zod';

export const LogActivitySchema = z.object({
  actorId: z.string().uuid().nullable().optional(),
  action: z.string().min(1, 'Action description is required'),
  organizationId: z.string().uuid('Invalid organization ID'),
  severity: z.enum(['info', 'warn', 'critical']).default('info'),
});
