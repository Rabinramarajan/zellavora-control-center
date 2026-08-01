import { z } from 'zod';

export const RoleScopeSchema = z.enum(['GLOBAL', 'ORG', 'RESOURCE']);
export const EntityStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const CreateRoleSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().max(500).nullable().optional(),
    scope: RoleScopeSchema.default('ORG'),
    status: EntityStatusSchema.default('ACTIVE'),
    isSystem: z.boolean().default(false),
    organizationId: z.string().uuid('Invalid organization id').optional(),
  })
  .strict();

export const UpdateRoleSchema = z
  .object({
    name: z.string().min(2).optional(),
    description: z.string().max(500).nullable().optional(),
    status: EntityStatusSchema.optional(),
  })
  .strict();

export const RoleListQuerySchema = z.object({
  q: z.string().optional(),
  scope: z.array(RoleScopeSchema).optional(),
  status: z.array(EntityStatusSchema).optional(),
  organizationId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['name', 'scope', 'status', 'createdAt']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const PermissionEffectSchema = z.enum(['allow', 'deny']);

export const RolePermissionItemSchema = z.object({
  permissionId: z.string().uuid('Invalid permission id'),
  effect: PermissionEffectSchema,
});

export const SetRolePermissionsSchema = z
  .object({
    permissions: z.array(RolePermissionItemSchema).default([]),
    mode: z.enum(['replace', 'merge']).default('replace'),
  })
  .strict();

export const CopyRoleSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().max(500).nullable().optional(),
    includePermissions: z.boolean().default(true),
  })
  .strict();

export type CreateRoleDto = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleDto = z.infer<typeof UpdateRoleSchema>;
export type RoleListQueryDto = z.infer<typeof RoleListQuerySchema>;
export type SetRolePermissionsDto = z.infer<typeof SetRolePermissionsSchema>;
export type CopyRoleDto = z.infer<typeof CopyRoleSchema>;
