import { z } from 'zod';

export const CreateProjectDTO = z.object({
  title: z.string().min(3).max(255),
  description: z.string().max(2000).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  organizationId: z.string().uuid(),
  tags: z.array(z.string()).optional(),
  thumbnail: z.string().optional(),
});

export const UpdateProjectDTO = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  tags: z.array(z.string()).optional(),
  thumbnail: z.string().optional(),
});

export const ProjectQueryDTO = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['recent', 'name', 'status']).default('recent'),
});

export type CreateProjectDTOType = z.infer<typeof CreateProjectDTO>;
export type UpdateProjectDTOType = z.infer<typeof UpdateProjectDTO>;
export type ProjectQueryDTOType = z.infer<typeof ProjectQueryDTO>;
