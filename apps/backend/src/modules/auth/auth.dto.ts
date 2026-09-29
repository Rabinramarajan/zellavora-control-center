import { z } from 'zod';
import { PasswordPolicySchema } from '../../services/auth';

// Control characters (C0 + DEL + C1) are never valid in a person's name.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email must be at most 254 characters')
  .email('Enter a valid email address');

const personName = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `${label} must be at least 2 characters`)
    .max(100, `${label} must be at most 100 characters`)
    .refine((v) => !CONTROL_CHARS.test(v), `${label} contains invalid characters`);

const clientCode = z
  .string()
  .trim()
  .min(2)
  .max(16)
  .regex(/^[A-Za-z0-9-]+$/, 'Invalid organization code');

const opaqueToken = z.string().trim().min(20).max(256);

// Presence only: the strength policy applies when a password is set, not when
// one is presented. Never truncated — over-long input is rejected.
const presentedPassword = z.string().min(1, 'Password is required').max(128);

export const LoginSchema = z.object({
  clientCode,
  email,
  password: presentedPassword,
  rememberMe: z.boolean().optional().default(false),
});

export const MfaVerifySchema = z.object({
  mfaToken: opaqueToken,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const RecoveryCodeSchema = z.object({
  mfaToken: opaqueToken,
  code: z
    .string()
    .trim()
    .transform((v) => v.replace(/[-\s]/g, '').toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{10}$/, 'Enter a valid recovery code')),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(10).max(4096),
});

export const RegisterSchema = z.object({
  clientCode,
  firstName: personName('First name'),
  lastName: personName('Last name'),
  email,
  password: PasswordPolicySchema,
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
});

export const InvitationTokenSchema = z.object({ token: opaqueToken });

export const AcceptInvitationSchema = z.object({
  token: opaqueToken,
  firstName: personName('First name'),
  lastName: personName('Last name'),
  password: PasswordPolicySchema,
});

export const VerifyEmailSchema = z.object({ token: opaqueToken });

export const EmailOnlySchema = z.object({ email });

export const ResetTokenSchema = z.object({ token: opaqueToken });

export const ResetPasswordSchema = z.object({
  token: opaqueToken,
  newPassword: PasswordPolicySchema,
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: presentedPassword,
    newPassword: PasswordPolicySchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must differ from the current password',
    path: ['newPassword'],
  });

export const PasswordConfirmSchema = z.object({ password: presentedPassword });

export const MfaEnrollConfirmSchema = z.object({
  enrollmentToken: opaqueToken,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const MfaDisableSchema = z.object({
  password: presentedPassword,
  code: z.string().trim().min(6).max(20),
});

export const SwitchTenantSchema = z.object({ organizationId: z.string().uuid() });

export const SessionIdSchema = z.object({ sessionId: z.string().uuid() });

// Avatars are resized client-side and stored inline as a data URL.
export const UpdateAvatarSchema = z.object({
  avatar: z
    .string()
    .max(300_000, 'Avatar image is too large')
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/, 'Unsupported avatar format')
    .nullable(),
});

export type LoginDto = z.infer<typeof LoginSchema>;
export type RegisterDto = z.infer<typeof RegisterSchema>;
export type AcceptInvitationDto = z.infer<typeof AcceptInvitationSchema>;
