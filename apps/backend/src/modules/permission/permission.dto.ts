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
