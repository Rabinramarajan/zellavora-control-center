import { z } from 'zod';

export const CMS_PAGE_STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const;
export type CmsPageStatus = (typeof CMS_PAGE_STATUSES)[number];

export const CMS_PAGE_TYPES = ['STANDARD', 'LANDING', 'ARTICLE', 'SYSTEM', 'CUSTOM'] as const;
export type CmsPageType = (typeof CMS_PAGE_TYPES)[number];

const SLUG = /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

export const CreatePageSchema = z
  .object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200),
    type: z.enum(CMS_PAGE_TYPES).default('STANDARD'),
    template: z.string().trim().max(60).optional(),
    parentId: z.string().uuid().optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(200)
      .regex(SLUG, 'Use lowercase letters, numbers, hyphens and forward slashes')
      .optional(),
  })
  .strict();

export const UpdatePageSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    metaTitle: optionalText(70),
    metaDescription: optionalText(160),
    seo: z
      .object({
        canonicalUrl: z.string().url().max(500).optional(),
        noIndex: z.boolean().optional(),
        noFollow: z.boolean().optional(),
        ogTitle: optionalText(70),
        ogDescription: optionalText(200),
        ogImage: z.string().url().max(1000).nullable().optional(),
        structuredData: z.string().max(10_000).nullable().optional(),
      })
      .optional(),
  })
  .strict();

export const SaveBuilderSchema = z.object({
  sections: z.array(z.record(z.unknown())).default([]),
  version: z.number().int().min(1).default(1),
});

export const SchedulePageSchema = z
  .object({ scheduledAt: z.coerce.date() })
  .strict();

export const PageListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(CMS_PAGE_STATUSES).optional(),
  type: z.enum(CMS_PAGE_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(['title', 'status', 'type', 'createdAt', 'updatedAt', 'publishedAt'])
    .default('updatedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const SlugCheckSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  excludeId: z.string().uuid().optional(),
});

export type CreatePageDto = z.infer<typeof CreatePageSchema>;
export type UpdatePageDto = z.infer<typeof UpdatePageSchema>;
export type SaveBuilderDto = z.infer<typeof SaveBuilderSchema>;
export type PageListQueryDto = z.infer<typeof PageListQuerySchema>;
