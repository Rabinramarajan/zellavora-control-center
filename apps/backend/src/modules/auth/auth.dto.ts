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

/**
 * Registration types the public endpoint accepts. PARTNER, VENDOR and
 * CONTRACTOR exist in the database enum but are not self-service yet, so they
 * are deliberately absent here — an unimplemented type must fail validation
 * rather than reach a handler that cannot serve it.
 */
export const SELF_SERVICE_REGISTRATION_TYPES = [
  'ORGANIZATION_MEMBER',
  'INDIVIDUAL',
  'CREATE_ORGANIZATION',
] as const;

export type SelfServiceRegistrationType = (typeof SELF_SERVICE_REGISTRATION_TYPES)[number];

const acceptTerms = z.literal(true, {
  errorMap: () => ({ message: 'You must accept the terms' }),
});

const registrant = {
  firstName: personName('First name'),
  lastName: personName('Last name'),
  email,
  password: PasswordPolicySchema,
  acceptTerms,
};

const organizationName = z
  .string()
  .trim()
  .min(2, 'Organization name must be at least 2 characters')
  .max(120, 'Organization name must be at most 120 characters')
  .refine((v) => !CONTROL_CHARS.test(v), 'Organization name contains invalid characters');

// IANA zone, e.g. Asia/Kolkata. Validated for shape here and against the
// runtime's own zone table in the service, which is the only authority.
const timezone = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){0,2}$/, 'Select a valid time zone');

const country = z
  .string()
  .trim()
  .length(2, 'Select a country')
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Select a country');

/**
 * Conditional by registration type. A discriminated union rather than one wide
 * optional-everything object, so an individual registration carrying a
 * clientCode is a validation error instead of a silently ignored field.
 */
const RegistrationUnion = z.discriminatedUnion('registrationType', [
  z.object({
    registrationType: z.literal('ORGANIZATION_MEMBER'),
    clientCode,
    ...registrant,
  }),
  z.object({
    registrationType: z.literal('INDIVIDUAL'),
    ...registrant,
  }),
  z.object({
    registrationType: z.literal('CREATE_ORGANIZATION'),
    organization: z.object({
      name: organizationName,
      code: clientCode,
      businessEmail: email,
      country,
      timezone,
    }),
    ...registrant,
  }),
]);

/**
 * A missing `registrationType` is read as ORGANIZATION_MEMBER, which is what
 * every request meant before types existed. This keeps already-deployed clients
 * working; it is not a default for new ones, which always send the type.
 */
export const RegisterSchema = z.preprocess(
  (value) =>
    value && typeof value === 'object' && !('registrationType' in value)
      ? { ...value, registrationType: 'ORGANIZATION_MEMBER' }
      : value,
  RegistrationUnion
);

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
/**
 * Declared rather than inferred. This tsconfig runs with `strictNullChecks`
 * off, under which zod's inference marks every property optional — including
 * the discriminant, which makes `Extract` on the union collapse to `never`.
 * These mirror the schemas above; keep them in step.
 */
interface Registrant {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  acceptTerms: true;
}

export interface RegisterOrganizationMemberDto extends Registrant {
  registrationType: 'ORGANIZATION_MEMBER';
  clientCode: string;
}

export interface RegisterIndividualDto extends Registrant {
  registrationType: 'INDIVIDUAL';
}

export interface RegisterOrganizationDto extends Registrant {
  registrationType: 'CREATE_ORGANIZATION';
  organization: {
    name: string;
    code: string;
    businessEmail: string;
    country: string;
    timezone: string;
  };
}

export type RegisterDto =
  RegisterOrganizationMemberDto | RegisterIndividualDto | RegisterOrganizationDto;
export type AcceptInvitationDto = z.infer<typeof AcceptInvitationSchema>;

/** Query for the public organization-code availability check. */
export const OrganizationCodeSchema = z.object({ code: clientCode });
