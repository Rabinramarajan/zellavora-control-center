import { z } from 'zod';

export const ListNotificationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export type ListNotificationsQuery = Required<z.infer<typeof ListNotificationsQuerySchema>>;
