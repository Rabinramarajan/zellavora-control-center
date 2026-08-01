import { z } from 'zod';

export const GroupTypeSchema = z.enum(['SECURITY', 'ORG', 'DISTRIBUTION', 'PROJECT', 'DYNAMIC']);
export const EntityStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const CreateGroupSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().max(500).nullable().optional(),
    type: GroupTypeSchema.default('SECURITY'),
    status: EntityStatusSchema.default('ACTIVE'),
    parentId: z.string().uuid('Invalid parent id').nullable().optional(),
    ownerId: z.string().uuid('Invalid owner id').nullable().optional(),
    memberIds: z.array(z.string().uuid('Invalid member id')).default([]),
    roleIds: z.array(z.string().uuid('Invalid role id')).default([]),
  })
  .strict();

export const UpdateGroupSchema = z
  .object({
    name: z.string().min(2).optional(),
    description: z.string().max(500).nullable().optional(),
    status: EntityStatusSchema.optional(),
    parentId: z.string().uuid('Invalid parent id').nullable().optional(),
    ownerId: z.string().uuid('Invalid owner id').nullable().optional(),
  })
  .strict();

export const GroupListQuerySchema = z.object({
  q: z.string().optional(),
  type: z.array(GroupTypeSchema).optional(),
  status: z.array(EntityStatusSchema).optional(),
  parentId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  isSystem: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['name', 'type', 'status', 'createdAt']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const AddGroupMembersSchema = z
  .object({
    userIds: z.array(z.string().uuid('Invalid user id')).min(1, 'At least one user is required'),
  })
  .strict();

export const SetGroupRolesSchema = z
  .object({
    roleIds: z.array(z.string().uuid('Invalid role id')).default([]),
    mode: z.enum(['replace', 'merge']).default('replace'),
  })
  .strict();

export type CreateGroupDto = z.infer<typeof CreateGroupSchema>;
export type UpdateGroupDto = z.infer<typeof UpdateGroupSchema>;
export type GroupListQueryDto = z.infer<typeof GroupListQuerySchema>;
export type AddGroupMembersDto = z.infer<typeof AddGroupMembersSchema>;
export type SetGroupRolesDto = z.infer<typeof SetGroupRolesSchema>;
