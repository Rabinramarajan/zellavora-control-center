import { z } from 'zod';

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  clientCode: z.string().min(2).max(16).regex(/^[a-zA-Z0-9-]+$/),
  logoUrl: z.string().nullable().optional(),
});

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(2).optional(),
  logoUrl: z.string().nullable().optional(),
  enforce2fa: z.boolean().optional(),
});
