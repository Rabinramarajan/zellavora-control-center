import { z } from 'zod';

export const LoginSchema = z.object({
  identifier: z.string().min(1, 'Username or Email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const LoginMfaSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  code: z.string().length(6, 'MFA code must be exactly 6 digits'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
