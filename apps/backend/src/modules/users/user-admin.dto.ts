import { z } from 'zod';

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null));
const name = z
  .string()
  .trim()
  .min(2, 'Must be 2–100 characters')
  .max(100, 'Must be 2–100 characters')
  .optional();
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address')
  .max(254)
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));
const phone = z
  .string()
  .trim()
  .regex(/^[+0-9 ()-]{6,20}$/, 'Invalid phone number')
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));
const uuid = z.string().uuid().nullable().optional();

export const EMPLOYMENT_TYPES = [
  'PERMANENT',
  'CONTRACT',
  'CONSULTANT',
  'INTERN',
  'EXTERNAL',
] as const;
export const USER_TYPES = ['EMPLOYEE', 'CONTRACTOR', 'EXTERNAL'] as const;
export const ACCESS_SCOPES = [
  'GLOBAL',
  'ORGANIZATION',
  'BRANCH',
  'DEPARTMENT',
  'TEAM',
  'OWN',
] as const;
export const LANGUAGES = ['en', 'ta', 'hi', 'fr', 'de', 'es', 'ar'] as const;

const isTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const UpdateUserProfileSchema = z
  .object({
    personal: z
      .object({
        username: z
          .string()
          .trim()
          .toLowerCase()
          .regex(
            /^[a-z0-9_.-]{3,50}$/,
            'Username: 3–50 lowercase letters, digits, dot, dash or underscore'
          )
          .optional(),
        firstName: name,
        middleName: text(100),
        lastName: name,
        displayName: text(200),
        userType: z.enum(USER_TYPES).nullable().optional(),
        avatarUrl: z
          .string()
          .trim()
          .url('Profile image must be a URL')
          .regex(
            /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i,
            'Profile image must be PNG, JPG, WEBP, GIF or SVG'
          )
          .max(1000)
          .nullable()
          .optional()
          .or(z.literal('').transform(() => null)),
        language: z.enum(LANGUAGES).optional(),
        timezone: z
          .string()
          .trim()
          .refine(isTimezone, 'Unknown time zone')
          .nullable()
          .optional()
          .or(z.literal('').transform(() => null)),
      })
      .strict()
      .optional(),
    employee: z
      .object({
        employeeCode: z.string().trim().min(1).max(50).optional(),
        employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
        designation: text(150),
        joiningDate: z.coerce
          .date()
          .nullable()
          .optional()
          .refine(
            (d) => !d || d <= new Date(Date.now() + 365 * 86_400_000),
            'Joining date is too far ahead'
          ),
        company: text(200),
        workLocation: text(200),
        costCenter: text(50),
      })
      .strict()
      .optional(),
    contact: z
      .object({
        workEmail: z
          .string()
          .trim()
          .toLowerCase()
          .email('Invalid email address')
          .max(254)
          .optional(),
        mobile: phone,
        alternateEmail: email,
        alternateMobile: phone,
        addressLine1: text(200),
        addressLine2: text(200),
        city: text(100),
        state: text(100),
        country: text(100),
        postalCode: text(20),
      })
      .strict()
      .optional(),
    organization: z
      .object({
        branchId: uuid,
        departmentId: uuid,
        teamId: uuid,
        reportingManagerId: uuid,
        assignedOfficerId: uuid,
        accessScope: z.enum(ACCESS_SCOPES).nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const AddUserNoteSchema = z
  .object({
    body: z.string().trim().min(1, 'Note cannot be empty').max(4000),
    noteType: z.enum(['GENERAL', 'SECURITY', 'ACCESS', 'HR']).default('GENERAL'),
    visibility: z.enum(['INTERNAL', 'ADMINS']).default('INTERNAL'),
    attachmentUrl: z.string().trim().url().max(1000).nullable().optional(),
  })
  .strict();

export const ReasonSchema = z
  .object({ reason: z.string().trim().max(500).nullable().optional() })
  .strict();

export type UpdateUserProfileDto = z.infer<typeof UpdateUserProfileSchema>;
export type AddUserNoteDto = z.infer<typeof AddUserNoteSchema>;
