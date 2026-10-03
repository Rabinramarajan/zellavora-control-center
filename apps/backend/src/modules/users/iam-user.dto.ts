import { z } from 'zod';

export const UserStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'LOCKED',
  'PENDING',
  'SUSPENDED',
  'DISABLED',
]);

const csv = <T extends z.ZodTypeAny>(item: T) =>
  z
    .preprocess((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v), z.array(item))
    .optional();

/** Account statuses as shown to admins; PENDING is accepted for older clients. */
export const AccountStatusFilterSchema = z.enum([
  'INVITED',
  'PENDING_VERIFICATION',
  'PENDING',
  'ACTIVE',
  'INACTIVE',
  'LOCKED',
  'SUSPENDED',
  'DISABLED',
]);

export const IamUserListQuerySchema = z.object({
  q: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  username: z.string().trim().optional(),
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  employeeCode: z.string().trim().optional(),
  status: csv(AccountStatusFilterSchema),
  userType: csv(z.enum(['EMPLOYEE', 'CONTRACTOR', 'EXTERNAL'])),
  branchId: csv(z.string().uuid()),
  departmentId: csv(z.string().uuid()),
  teamId: csv(z.string().uuid()),
  roleId: csv(z.string().uuid()),
  groupId: csv(z.string().uuid()),
  emailVerified: z.enum(['true', 'false']).optional(),
  mfaEnabled: z.enum(['true', 'false']).optional(),
  department: z.string().optional(),
  isAccountLocked: z.enum(['true', 'false']).optional(),
  name: z.string().trim().optional(),
  email: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  lastLoginFrom: z.coerce.date().optional(),
  lastLoginTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum([
      'userNo',
      'fullName',
      'email',
      'status',
      'department',
      'employeeCode',
      'createdAt',
      'lastLoginDatetime',
    ])
    .default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const LockUserSchema = z
  .object({
    reason: z.string().max(500).nullable().optional(),
  })
  .strict();

export type IamUserListQueryDto = z.infer<typeof IamUserListQuerySchema>;
export type LockUserDto = z.infer<typeof LockUserSchema>;
