import { z } from 'zod';

export const CreateBranchSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  name: z.string().min(2, 'Branch name must be at least 2 characters'),
  code: z.string().nullable().optional(),
});

export const UpdateBranchSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().nullable().optional(),
});
