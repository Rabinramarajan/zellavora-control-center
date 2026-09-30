import { z } from 'zod';

export const CreatePermissionSchema = z.object({
  name: z.string().min(2, 'Permission name must be at least 2 characters'),
  description: z.string().nullable().optional(),
  groupId: z.string().uuid('Invalid group ID').nullable().optional(),
});

export const AssignPermissionSchema = z.object({
  roleId: z.string().uuid('Invalid role ID'),
  permissionId: z.string().uuid('Invalid permission ID'),
  organizationId: z.string().uuid('Invalid organization ID'),
  effect: z.enum(['allow', 'deny']).default('allow'),
});

const segment = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z][a-z0-9_-]*$/, 'Use lowercase letters, digits, - and _');

/** IAM catalog entry: the key is always `resource:action`. */
export const CreateIamPermissionSchema = z
  .object({
    resource: segment,
    action: segment,
    description: z.string().trim().max(500).nullable().optional(),
    groupId: z.string().uuid().nullable().optional(),
  })
  .strict();

export const UpdateIamPermissionSchema = z
  .object({
    description: z.string().trim().max(500).nullable().optional(),
    groupId: z.string().uuid().nullable().optional(),
  })
  .strict();

export const IamPermissionListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  resource: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const CreatePermissionGroupSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const IdParamSchema = z.object({ id: z.string().uuid() });

export type CreateIamPermissionDto = z.infer<typeof CreateIamPermissionSchema>;
export type UpdateIamPermissionDto = z.infer<typeof UpdateIamPermissionSchema>;
export type IamPermissionListQuery = z.infer<typeof IamPermissionListQuerySchema>;
export type CreatePermissionGroupDto = z.infer<typeof CreatePermissionGroupSchema>;
