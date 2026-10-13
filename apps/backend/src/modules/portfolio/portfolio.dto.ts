import { z } from 'zod';

/** Upper bound per collection. Keeps the editor lists and the public page bounded. */
export const PORTFOLIO_ITEM_LIMIT = 100;

const PHONE = /^\+?[0-9][0-9 ()-]{5,28}$/;
const ICON_KEY = /^[a-z0-9-]+$/;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Forms send '' for a cleared field. Store NULL so "empty" has one representation. */
const blankToNull = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? null : value;

type Optional<S extends z.ZodTypeAny> = z.ZodEffects<
  z.ZodOptional<z.ZodNullable<S>>,
  z.output<z.ZodOptional<z.ZodNullable<S>>>,
  unknown
>;

const optional = <S extends z.ZodTypeAny>(schema: S): Optional<S> =>
  z.preprocess(blankToNull, schema.nullable().optional());

const httpUrl = (max: number): z.ZodEffects<z.ZodString> =>
  z
    .string()
    .trim()
    .max(max)
    .url('Enter a valid URL')
    .refine((v) => /^https?:\/\//i.test(v), 'Use an http:// or https:// URL');

/** CTA buttons also accept mailto: links and in-app /relative paths. */
const linkUrl = (max: number): z.ZodEffects<z.ZodString> =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (v) => /^(https?:\/\/|mailto:|\/(?!\/))/i.test(v),
      'Use an https:// link, a mailto: link or a /relative path'
    );

const calendarDate = z
  .string()
  .regex(CALENDAR_DATE, 'Use the YYYY-MM-DD format')
  .refine((v) => {
    const date = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v;
  }, 'Enter a real date');

const requiredText = (max: number, message = 'This field is required'): z.ZodString =>
  z.string().trim().min(1, message).max(max);

// ---------------------------------------------------------------------------
// Singleton sections (one profile row per owner)
// ---------------------------------------------------------------------------

export const ProfileUpdateSchema = z
  .object({
    isPublic: z.boolean(),
    displayName: optional(z.string().trim().max(120)),
    headline: optional(z.string().trim().max(160)),
    location: optional(z.string().trim().max(120)),
    email: optional(z.string().trim().email('Enter a valid email').max(254)),
    phone: optional(z.string().trim().regex(PHONE, 'Enter a valid phone number')),
    website: optional(httpUrl(500)),
    github: optional(httpUrl(500)),
    linkedin: optional(httpUrl(500)),
    twitter: optional(httpUrl(500)),
    avatarUrl: optional(httpUrl(1000)),
    resumeUrl: optional(httpUrl(1000)),
  })
  .strict()
  .partial();

export const HeroUpdateSchema = z
  .object({
    greeting: optional(z.string().trim().max(80)),
    title: optional(z.string().trim().max(160)),
    subtitle: optional(z.string().trim().max(400)),
    primaryCtaLabel: optional(z.string().trim().max(40)),
    primaryCtaUrl: optional(linkUrl(500)),
    secondaryCtaLabel: optional(z.string().trim().max(40)),
    secondaryCtaUrl: optional(linkUrl(500)),
    imageUrl: optional(httpUrl(1000)),
  })
  .strict()
  .partial();

export const AboutUpdateSchema = z
  .object({
    body: optional(z.string().trim().max(10_000)),
    imageUrl: optional(httpUrl(1000)),
  })
  .strict()
  .partial();

// ---------------------------------------------------------------------------
// Collections (owner-scoped lists with soft delete and manual ordering)
// ---------------------------------------------------------------------------

export const SkillCreateSchema = z
  .object({
    name: requiredText(60),
    category: optional(z.string().trim().max(60)),
    level: z.number().int().min(0).max(100).nullable().optional(),
  })
  .strict();
export const SkillUpdateSchema = SkillCreateSchema.partial().strict();

export const ExperienceCreateSchema = z
  .object({
    role: requiredText(160),
    company: requiredText(160),
    location: optional(z.string().trim().max(120)),
    startDate: calendarDate,
    endDate: optional(calendarDate),
    isCurrent: z.boolean().default(false),
    description: optional(z.string().trim().max(4000)),
  })
  .strict();
export const ExperienceUpdateSchema = ExperienceCreateSchema.partial().strict();

export const EducationCreateSchema = z
  .object({
    institution: requiredText(160),
    degree: requiredText(160),
    field: optional(z.string().trim().max(160)),
    grade: optional(z.string().trim().max(60)),
    startDate: calendarDate,
    endDate: optional(calendarDate),
    description: optional(z.string().trim().max(2000)),
  })
  .strict();
export const EducationUpdateSchema = EducationCreateSchema.partial().strict();

export const ServiceCreateSchema = z
  .object({
    title: requiredText(120),
    description: optional(z.string().trim().max(1000)),
    icon: optional(
      z.string().trim().toLowerCase().max(40).regex(ICON_KEY, 'Use a lowercase icon key')
    ),
  })
  .strict();
export const ServiceUpdateSchema = ServiceCreateSchema.partial().strict();

export const TestimonialCreateSchema = z
  .object({
    authorName: requiredText(120),
    authorRole: optional(z.string().trim().max(160)),
    company: optional(z.string().trim().max(160)),
    quote: requiredText(1000, 'Enter the testimonial text'),
    avatarUrl: optional(httpUrl(1000)),
    rating: z.number().int().min(1).max(5).nullable().optional(),
  })
  .strict();
export const TestimonialUpdateSchema = TestimonialCreateSchema.partial().strict();

export const ReorderSchema = z
  .object({
    ids: z
      .array(z.string().uuid())
      .min(1)
      .max(PORTFOLIO_ITEM_LIMIT)
      .refine((ids) => new Set(ids).size === ids.length, 'Each id may appear only once'),
  })
  .strict();

export type ProfileUpdateDto = z.infer<typeof ProfileUpdateSchema>;
export type HeroUpdateDto = z.infer<typeof HeroUpdateSchema>;
export type AboutUpdateDto = z.infer<typeof AboutUpdateSchema>;
export type SkillCreateDto = z.infer<typeof SkillCreateSchema>;
export type SkillUpdateDto = z.infer<typeof SkillUpdateSchema>;
export type ExperienceCreateDto = z.infer<typeof ExperienceCreateSchema>;
export type ExperienceUpdateDto = z.infer<typeof ExperienceUpdateSchema>;
export type EducationCreateDto = z.infer<typeof EducationCreateSchema>;
export type EducationUpdateDto = z.infer<typeof EducationUpdateSchema>;
export type ServiceCreateDto = z.infer<typeof ServiceCreateSchema>;
export type ServiceUpdateDto = z.infer<typeof ServiceUpdateSchema>;
export type TestimonialCreateDto = z.infer<typeof TestimonialCreateSchema>;
export type TestimonialUpdateDto = z.infer<typeof TestimonialUpdateSchema>;
export type ReorderDto = z.infer<typeof ReorderSchema>;

/** Returns a message when the end date is before the start, or when a current role has one. */
export function dateRangeError(
  startDate: string,
  endDate: string | null | undefined,
  isCurrent = false
): string | null {
  if (!endDate) return null;
  if (isCurrent) return 'A current position cannot have an end date';
  return endDate < startDate ? 'End date must be on or after the start date' : null;
}

/** Calendar dates are stored as UTC midnight so they round-trip without timezone drift. */
export const toDateOnly = (value: string): Date => new Date(`${value}T00:00:00Z`);
export const fromDateOnly = (value: Date): string => value.toISOString().slice(0, 10);
