import { z } from 'zod';

export const VerifyInvitationSchema = z.object({
  code: z.string().min(1, 'Code is required'),
});

export const GenerateInvitationSchema = z.object({
  email: z.string().email('Invalid email address'),
});
