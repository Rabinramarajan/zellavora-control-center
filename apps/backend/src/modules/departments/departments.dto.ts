import { z } from 'zod';

const DepartmentStatusSchema = z.enum(['active', 'inactive']);

export const CreateDepartmentSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
    code: z
      .string()
      .trim()
      .max(20)
      .regex(/^[A-Za-z0-9_-]*$/, 'Code may only contain letters, digits, - and _')
      .nullable()
      .optional(),
    description: z.string().trim().max(500).nullable().optional(),
    parentId: z.string().uuid().nullable().optional(),
    status: DepartmentStatusSchema.default('active'),
  })
  .strict();

export const UpdateDepartmentSchema = CreateDepartmentSchema.partial().strict();

export const DepartmentListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: DepartmentStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const DepartmentMembersSchema = z
  .object({ userIds: z.array(z.string().uuid()).min(1).max(500) })
  .strict();

export const IdParamSchema = z.object({ id: z.string().uuid() });
export const MemberParamSchema = z.object({ id: z.string().uuid(), userId: z.string().uuid() });

export type CreateDepartmentDto = z.infer<typeof CreateDepartmentSchema>;
export type UpdateDepartmentDto = z.infer<typeof UpdateDepartmentSchema>;
export type DepartmentListQuery = z.infer<typeof DepartmentListQuerySchema>;
