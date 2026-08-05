import { z } from 'zod';

export const CreateTeamDTO = z.object({
  name: z.string().min(3).max(255),
  description: z.string().max(2000).optional(),
  organizationId: z.string().uuid(),
  members: z.array(z.string().uuid()).optional(),
});

export const UpdateTeamDTO = z.object({
  name: z.string().min(3).max(255).optional(),
  description: z.string().max(2000).optional(),
});

export const AddTeamMemberDTO = z.object({
  userId: z.string().uuid(),
  role: z.enum(['member', 'lead', 'admin']).default('member'),
});

export const RemoveTeamMemberDTO = z.object({
  userId: z.string().uuid(),
});

export const TeamQueryDTO = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(['recent', 'name', 'members']).default('recent'),
});

export type CreateTeamDTOType = z.infer<typeof CreateTeamDTO>;
export type UpdateTeamDTOType = z.infer<typeof UpdateTeamDTO>;
export type AddTeamMemberDTOType = z.infer<typeof AddTeamMemberDTO>;
export type RemoveTeamMemberDTOType = z.infer<typeof RemoveTeamMemberDTO>;
export type TeamQueryDTOType = z.infer<typeof TeamQueryDTO>;
