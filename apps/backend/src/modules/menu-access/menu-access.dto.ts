import { z } from 'zod';

export const MenuAccessRoleParamsSchema = z.object({
  roleId: z.string().uuid(),
});

export const UpdateMenuAccessSchema = z.object({
  /** Limit the role's sidebar to `keys`; when false every usable entry shows. */
  restricted: z.boolean(),
  /** Menu keys (not permission keys), e.g. "freelancer", "timesheets". */
  keys: z.array(z.string().trim().min(1).max(80)).max(300),
});

export type UpdateMenuAccessDTO = z.infer<typeof UpdateMenuAccessSchema>;
