import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(4, 'Username must be at least 4 characters'),
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  passwordPlain: z.string().min(12, 'Password must be at least 12 characters'),
  role: z.string().optional(),
});

export const UpdateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  passwordPlain: z.string().min(12).optional(),
  avatarUrl: z.string().nullable().optional(),
});
