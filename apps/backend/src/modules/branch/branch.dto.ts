import { z } from 'zod';

export const BranchStatusSchema = z.enum(['active', 'inactive']);

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

/** `code` is deliberately absent: it is generated server-side and immutable. */
export const CreateBranchSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
    isHeadOffice: z.boolean().default(false),
    address: optionalText(300),
    city: optionalText(100),
    state: optionalText(100),
    country: optionalText(100),
    pincode: z
      .string()
      .trim()
      .max(12)
      .regex(/^[A-Za-z0-9 -]*$/, 'Postal code may only contain letters, digits, spaces and -')
      .nullable()
      .optional(),
    phone: z
      .string()
      .trim()
      .max(20)
      .regex(/^[0-9+()\s-]*$/, 'Phone may only contain digits, spaces and + ( ) -')
      .nullable()
      .optional(),
    email: z
      .union([z.string().trim().email('Invalid email').max(254), z.literal('')])
      .nullable()
      .optional(),
    status: BranchStatusSchema.default('active'),
  })
  .strict();

export const UpdateBranchSchema = CreateBranchSchema.partial().strict();

export const BranchListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: BranchStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  /** Omitted: head office first, then name. */
  sort: z.enum(['code', 'name', 'city', 'status', 'updatedAt']).optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const IdParamSchema = z.object({ id: z.string().uuid() });

export type BranchStatus = z.infer<typeof BranchStatusSchema>;
export type CreateBranchDto = z.infer<typeof CreateBranchSchema>;
export type UpdateBranchDto = z.infer<typeof UpdateBranchSchema>;
export type BranchListQuery = z.infer<typeof BranchListQuerySchema>;
