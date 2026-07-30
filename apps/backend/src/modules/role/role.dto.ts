import { z } from 'zod';

export const CreateRoleSchema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters'),
  organizationId: z.string().uuid('Invalid organization ID').nullable().optional(),
  description: z.string().nullable().optional(),
});

export const UpdateRoleSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
});
