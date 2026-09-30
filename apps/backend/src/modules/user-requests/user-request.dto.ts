import { z } from 'zod';
import {
  ACCESS_SCOPES,
  EMPLOYMENT_TYPES,
  NOTE_TYPES,
  NOTE_VISIBILITIES,
  PRIORITIES,
  REQUEST_STATUSES,
  REQUEST_TYPES,
  USER_TYPES,
} from './user-request.types';

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));
const optUuid = z
  .string()
  .uuid()
  .nullable()
  .optional()
  .transform((v) => v ?? null);
const optDate = z.coerce
  .date()
  .nullable()
  .optional()
  .transform((v) => v ?? null);
const uuidList = z.array(z.string().uuid()).default([]);
const csv = <T extends z.ZodTypeAny>(item: T) =>
  z
    .preprocess((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v), z.array(item))
    .optional();

const nameText = z
  .string()
  .trim()
  .max(100)
  .nullable()
  .optional()
  .refine((v) => !v || v.length >= 2, 'Must be 2–100 characters')
  .transform((v) => (v ? v : null));

export const UserSectionSchema = z
  .object({
    username: z
      .string()
      .trim()
      .regex(
        /^[a-z0-9_.-]{3,50}$/,
        'Username: 3–50 lowercase letters, digits, dot, dash or underscore'
      )
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    firstName: nameText,
    middleName: optText(100),
    lastName: nameText,
    displayName: optText(200),
    userType: z
      .enum(USER_TYPES)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
  })
  .strict();

export const EmployeeSectionSchema = z
  .object({
    employeeCode: optText(50),
    employmentType: z
      .enum(EMPLOYMENT_TYPES)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    designation: optText(150),
    joiningDate: optDate,
    company: optText(200),
    workLocation: optText(200),
  })
  .strict();

const optEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address')
  .max(254)
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null))
  .transform((v) => v ?? null);
const optPhone = z
  .string()
  .trim()
  .regex(/^[+0-9 ()-]{6,20}$/, 'Invalid phone number')
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null))
  .transform((v) => v ?? null);

export const ContactSectionSchema = z
  .object({
    workEmail: optEmail,
    contactNumber: optPhone,
    alternateEmail: optEmail,
    alternateContactNumber: optPhone,
    addressLine1: optText(200),
    addressLine2: optText(200),
    city: optText(100),
    state: optText(100),
    country: optText(100),
    postalCode: optText(20),
  })
  .strict();

export const OrganizationSectionSchema = z
  .object({
    branchId: optUuid,
    departmentId: optUuid,
    teamId: optUuid,
    reportingManagerId: optUuid,
    assignedOfficerId: optUuid,
    costCenter: optText(50),
    location: optText(200),
    accessScope: z
      .enum(ACCESS_SCOPES)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
  })
  .strict();

export const AccessSectionSchema = z
  .object({
    addGroupIds: uuidList,
    removeGroupIds: uuidList,
    addRoleIds: uuidList,
    removeRoleIds: uuidList,
  })
  .strict();

export const RequestPayloadSchema = z
  .object({
    user: UserSectionSchema.default({}),
    employee: EmployeeSectionSchema.default({}),
    contact: ContactSectionSchema.default({}),
    organization: OrganizationSectionSchema.default({}),
    access: AccessSectionSchema.default({}),
  })
  .strict();

const RequestBodySchema = z.object({
  type: z.enum(REQUEST_TYPES),
  targetUserId: optUuid,
  priority: z.enum(PRIORITIES).default('NORMAL'),
  justification: z
    .string()
    .trim()
    .min(10, 'Business justification must be at least 10 characters')
    .max(2000),
  effectiveFrom: optDate,
  effectiveUntil: optDate,
  attachmentUrl: z
    .string()
    .trim()
    .url()
    .max(1000)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  payload: RequestPayloadSchema.default({}),
});

const effectiveRange = (v: { effectiveFrom: Date | null; effectiveUntil: Date | null }) =>
  !v.effectiveFrom || !v.effectiveUntil || v.effectiveUntil > v.effectiveFrom;

export const CreateUserRequestSchema = RequestBodySchema.extend({
  submit: z.boolean().default(false),
})
  .strict()
  .refine(effectiveRange, {
    message: 'Effective Until must be after Effective From',
    path: ['effectiveUntil'],
  });

export const UpdateUserRequestSchema = RequestBodySchema.omit({ type: true })
  .strict()
  .refine(effectiveRange, {
    message: 'Effective Until must be after Effective From',
    path: ['effectiveUntil'],
  });

export const AccessPreviewSchema = z
  .object({
    type: z.enum(REQUEST_TYPES),
    targetUserId: optUuid,
    payload: RequestPayloadSchema.default({}),
  })
  .strict();

export const UserRequestListQuerySchema = z.object({
  refNo: z.string().trim().optional(),
  type: csv(z.enum(REQUEST_TYPES)),
  name: z.string().trim().optional(),
  employeeCode: z.string().trim().optional(),
  email: z.string().trim().optional(),
  requestedById: z.string().uuid().optional(),
  branchId: csv(z.string().uuid()),
  departmentId: csv(z.string().uuid()),
  teamId: csv(z.string().uuid()),
  groupId: csv(z.string().uuid()),
  roleId: csv(z.string().uuid()),
  status: csv(z.enum(REQUEST_STATUSES)),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['refNo', 'createdAt', 'status', 'subjectName', 'priority']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const ActionCommentSchema = z
  .object({
    comments: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .transform((v) => v || null),
  })
  .strict();

export const RequiredCommentSchema = z
  .object({ comments: z.string().trim().min(3, 'A comment is required').max(2000) })
  .strict();

export const AddNoteSchema = z
  .object({
    body: z.string().trim().min(1, 'Note cannot be empty').max(4000),
    noteType: z.enum(NOTE_TYPES).default('GENERAL'),
    visibility: z.enum(NOTE_VISIBILITIES).default('INTERNAL'),
    attachmentUrl: z
      .string()
      .trim()
      .url()
      .max(1000)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
  })
  .strict();

export type RequestPayload = z.infer<typeof RequestPayloadSchema>;
export type CreateUserRequestDto = z.infer<typeof CreateUserRequestSchema>;
export type UpdateUserRequestDto = z.infer<typeof UpdateUserRequestSchema>;
export type AccessPreviewDto = z.infer<typeof AccessPreviewSchema>;
export type UserRequestListQueryDto = z.infer<typeof UserRequestListQuerySchema>;
export type AddNoteDto = z.infer<typeof AddNoteSchema>;
