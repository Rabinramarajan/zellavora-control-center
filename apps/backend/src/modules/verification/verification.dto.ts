import { z } from 'zod';

export const RequestOtpSchema = z.object({
  type: z.enum(['email', 'phone']),
  target: z.string().min(3, 'Target destination is required'),
});

export const VerifyOtpSchema = z.object({
  type: z.enum(['email', 'phone']),
  target: z.string().min(3),
  code: z.string().length(6, 'OTP must be exactly 6 digits'),
});
