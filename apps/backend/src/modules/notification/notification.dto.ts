import { z } from 'zod';

export const SendNotificationSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  recipientId: z.string().uuid('Invalid recipient ID').nullable().optional(),
  title: z.string().min(1, 'Title is required').nullable().optional(),
  body: z.string().min(1, 'Body is required'),
  channels: z.array(z.string()).optional(),
});
