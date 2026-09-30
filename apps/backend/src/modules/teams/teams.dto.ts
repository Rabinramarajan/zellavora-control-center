import { z } from 'zod';

export const CreateTeamSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
    description: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export const UpdateTeamSchema = CreateTeamSchema.partial().strict();

export const TeamListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const TeamMembersSchema = z
  .object({ userIds: z.array(z.string().uuid()).min(1).max(500) })
  .strict();

export const IdParamSchema = z.object({ id: z.string().uuid() });
export const MemberParamSchema = z.object({ id: z.string().uuid(), userId: z.string().uuid() });

export type CreateTeamDto = z.infer<typeof CreateTeamSchema>;
export type UpdateTeamDto = z.infer<typeof UpdateTeamSchema>;
export type TeamListQuery = z.infer<typeof TeamListQuerySchema>;
