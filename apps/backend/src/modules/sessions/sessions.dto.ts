import { z } from 'zod';

export const SessionListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  userId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const SessionIdParamSchema = z.object({ id: z.string().uuid() });
export const UserIdParamSchema = z.object({ userId: z.string().uuid() });

export type SessionListQuery = z.infer<typeof SessionListQuerySchema>;
