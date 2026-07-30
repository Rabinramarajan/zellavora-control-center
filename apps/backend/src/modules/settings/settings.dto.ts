import { z } from 'zod';

export const SaveSettingSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  key: z.string().min(1, 'Key is required'),
  value: z.string().min(1, 'Value is required'),
  category: z.string().nullable().optional(),
});
