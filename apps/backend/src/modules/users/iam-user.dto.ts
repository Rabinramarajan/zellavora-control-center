import { z } from 'zod';

export const UserStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING', 'SUSPENDED']);

export const CreateIamUserSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .regex(/^[a-z0-9_.-]+$/, 'Username may contain lowercase letters, digits, dot, dash, underscore')
      .optional(),
    fullName: z.string().min(2, 'Full name is required'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    mobile: z.string().optional(),
    department: z.string().nullable().optional(),
    jobTitle: z.string().nullable().optional(),
    timezone: z.string().optional(),
    language: z.string().default('en'),
    sendInvite: z.boolean().default(true),
    roleIds: z.array(z.string().uuid('Invalid role id')).default([]),
    groupIds: z.array(z.string().uuid('Invalid group id')).default([]),
  })
  .strict();

export const UpdateIamUserSchema = z
  .object({
    fullName: z.string().min(2).optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    mobile: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    jobTitle: z.string().nullable().optional(),
    timezone: z.string().nullable().optional(),
    language: z.string().optional(),
    status: UserStatusSchema.optional(),
  })
  .strict();

export const IamUserListQuerySchema = z.object({
  q: z.string().optional(),
  status: z.array(UserStatusSchema).optional(),
  roleId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  department: z.string().optional(),
  isAccountLocked: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['fullName', 'email', 'status', 'department', 'createdAt', 'lastLoginDatetime']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const SetUserRolesSchema = z
  .object({
    roleIds: z.array(z.string().uuid('Invalid role id')).default([]),
    mode: z.enum(['replace', 'merge']).default('replace'),
    organizationId: z.string().uuid('Invalid organization id').optional(),
  })
  .strict();

export const SetUserGroupsSchema = z
  .object({
    groupIds: z.array(z.string().uuid('Invalid group id')).default([]),
    mode: z.enum(['replace', 'merge']).default('replace'),
  })
  .strict();

export const SetUserStatusSchema = z
  .object({
    status: UserStatusSchema,
    reason: z.string().max(500).nullable().optional(),
  })
  .strict();

export const LockUserSchema = z
  .object({
    reason: z.string().max(500).nullable().optional(),
  })
  .strict();

export type CreateIamUserDto = z.infer<typeof CreateIamUserSchema>;
export type UpdateIamUserDto = z.infer<typeof UpdateIamUserSchema>;
export type IamUserListQueryDto = z.infer<typeof IamUserListQuerySchema>;
export type SetUserRolesDto = z.infer<typeof SetUserRolesSchema>;
export type SetUserGroupsDto = z.infer<typeof SetUserGroupsSchema>;
export type SetUserStatusDto = z.infer<typeof SetUserStatusSchema>;
export type LockUserDto = z.infer<typeof LockUserSchema>;
