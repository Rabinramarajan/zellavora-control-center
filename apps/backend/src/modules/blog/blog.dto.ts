import { z } from 'zod';

export const BLOG_STATUSES = ['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED'] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

const PostFields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .regex(SLUG, 'Use lowercase letters, numbers and hyphens')
    .optional(),
  excerpt: optionalText(400),
  content: z.string().max(200_000, 'Content is too long').default(''),
  category: z.string().trim().min(2, 'Choose a category').max(60),
  tags: z
    .array(z.string().trim().min(1).max(30))
    .max(10, 'Up to 10 tags')
    .default([])
    .transform((tags) => [...new Set(tags.map((t) => t.toLowerCase()))]),
  coverImageUrl: z
    .string()
    .trim()
    .max(1000)
    .url('Enter a valid URL')
    .refine((v) => v.startsWith('https://'), 'Use an https:// URL')
    .nullable()
    .optional(),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
};

export const CreatePostSchema = z.object(PostFields).strict();
export const UpdatePostSchema = z
  .object({ ...PostFields, version: z.number().int().min(1) })
  .partial()
  .strict();

export const PublishPostSchema = z
  .object({
    // Omitted or in the past: publish now. In the future: schedule.
    publishAt: z.coerce.date().optional(),
  })
  .strict();

export const PostListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
  status: z.enum(BLOG_STATUSES).optional(),
  period: z.enum(['7', '30', '90', '365']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sort: z
    .enum(['title', 'viewCount', 'publishedAt', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type CreatePostDto = z.infer<typeof CreatePostSchema>;
export type UpdatePostDto = z.infer<typeof UpdatePostSchema>;
export type PostListQueryDto = z.infer<typeof PostListQuerySchema>;
