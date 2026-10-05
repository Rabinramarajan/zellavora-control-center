import { z } from 'zod';

/** Reopening is audited, so the owner says why. */
export const ReopenSheetSchema = z.object({
  reason: z.string().trim().min(1, 'a reason is required to reopen').max(2000),
});

export type ReopenSheetDTO = z.infer<typeof ReopenSheetSchema>;
