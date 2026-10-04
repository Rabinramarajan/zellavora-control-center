import { z } from 'zod';

/** Who receives a message: explicit users, or every member of an org unit. */
export const AudienceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('all') }),
  z.object({ type: z.literal('users'), ids: z.array(z.string().uuid()).min(1).max(1000) }),
  z.object({ type: z.literal('group'), ids: z.array(z.string().uuid()).min(1).max(50) }),
  z.object({ type: z.literal('team'), ids: z.array(z.string().uuid()).min(1).max(50) }),
  z.object({ type: z.literal('department'), ids: z.array(z.string().uuid()).min(1).max(50) }),
]);

export const SendMessageSchema = z
  .object({
    audience: AudienceSchema,
    title: z.string().trim().min(1, 'Title is required').max(150),
    body: z.string().trim().min(1, 'Message is required').max(5000),
    type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
  })
  .strict();

export const SendEmailSchema = z
  .object({
    audience: AudienceSchema,
    subject: z.string().trim().min(1, 'Subject is required').max(200),
    body: z.string().trim().min(1, 'Body is required').max(20_000),
  })
  .strict();

export const HistoryQuerySchema = z.object({
  channel: z.enum(['in_app', 'email']),
  subject: z.string().trim().max(200).optional(),
  sentFrom: z.coerce.date().optional(),
  sentTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type Audience = z.infer<typeof AudienceSchema>;
export type SendMessageDto = z.infer<typeof SendMessageSchema>;
export type SendEmailDto = z.infer<typeof SendEmailSchema>;
export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;
