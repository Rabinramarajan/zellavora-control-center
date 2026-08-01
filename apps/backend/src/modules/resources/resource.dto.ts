import { z } from 'zod';

export const ResourceTypeSchema = z.enum([
  'API',
  'FEATURE',
  'DATA',
  'MENU',
  'REPORT',
  'INTEGRATION',
]);

export const EntityStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const ResourceActionInputSchema = z.object({
  action: z
    .string()
    .min(1, 'Action name is required')
    .regex(/^[a-z][a-z0-9_]*$/, 'Action must be lowercase alphanumeric/underscore'),
});

export const CreateResourceSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    key: z
      .string()
      .min(1, 'Key is required')
      .regex(/^[a-z][a-z0-9.]*$/, 'Key must be lowercase dotted (e.g. billing.invoices)'),
    type: ResourceTypeSchema.default('FEATURE'),
    category: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    parentId: z.string().uuid('Invalid parent id').nullable().optional(),
    ownerId: z.string().uuid('Invalid owner id').nullable().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
    actions: z.array(ResourceActionInputSchema).optional(),
  })
  .strict();

export const UpdateResourceSchema = z
  .object({
    name: z.string().min(2).optional(),
    category: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    parentId: z.string().uuid('Invalid parent id').nullable().optional(),
    ownerId: z.string().uuid('Invalid owner id').nullable().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
  })
  .strict();

export const AddResourceActionSchema = z
  .object({
    action: z
      .string()
      .min(1)
      .regex(/^[a-z][a-z0-9_]*$/),
  })
  .strict();

export const ResourceListQuerySchema = z.object({
  q: z.string().optional(),
  type: z.array(ResourceTypeSchema).optional(),
  category: z.string().optional(),
  status: z.array(EntityStatusSchema).optional(),
  parentId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  isSystem: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['name', 'type', 'category', 'createdAt']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateResourceDto = z.infer<typeof CreateResourceSchema>;
export type UpdateResourceDto = z.infer<typeof UpdateResourceSchema>;
export type AddResourceActionDto = z.infer<typeof AddResourceActionSchema>;
export type ResourceListQueryDto = z.infer<typeof ResourceListQuerySchema>;
