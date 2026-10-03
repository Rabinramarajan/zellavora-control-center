import { z } from 'zod';

// Profile, status and access edits are no longer accepted here: users are read-only and
// every change goes through a User Request (see user-requests module DTOs).

export const AddUserNoteSchema = z
  .object({
    body: z.string().trim().min(1, 'Note cannot be empty').max(4000),
    noteType: z.enum(['GENERAL', 'SECURITY', 'ACCESS', 'HR']).default('GENERAL'),
    visibility: z.enum(['INTERNAL', 'ADMINS']).default('INTERNAL'),
    attachmentUrl: z.string().trim().url().max(1000).nullable().optional(),
  })
  .strict();

export type AddUserNoteDto = z.infer<typeof AddUserNoteSchema>;
