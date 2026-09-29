import { z } from 'zod';

/** Decoded file size cap; base64 inflates by ~4/3, keeping requests under Vercel's 4.5 MB body limit. */
export const MAX_MEDIA_BYTES = 3 * 1024 * 1024;

export const UploadFileSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  base64Data: z.string().min(1, 'Base64 data is required'),
});

export const UploadMediaSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, 'File name is required')
    .max(255)
    .refine((name) => !/[\\/?#%:]/.test(name), 'File name contains invalid characters'),
  folder: z
    .string()
    .trim()
    .max(255)
    .default('')
    .refine(
      (folder) => !/[\\?#%:]/.test(folder) && !folder.split('/').some((part) => part === '..' || part === '.'),
      'Folder contains invalid characters'
    )
    .transform((folder) => folder.replace(/^\/+|\/+$/g, '')),
  mimeType: z.string().trim().max(127).optional(),
  base64Data: z.string().min(1, 'File content is required'),
});

export const ListMediaQuerySchema = z.object({
  prefix: z.string().trim().optional(),
  cursor: z.string().regex(/^\d+$/, 'Invalid cursor').optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export const MediaPathQuerySchema = z.object({
  pathname: z.string().trim().min(1, 'pathname is required'),
});

export const MediaIdParamSchema = z.object({
  id: z.string().uuid('Invalid media id'),
});

export type UploadMediaInput = z.infer<typeof UploadMediaSchema>;
export type ListMediaQuery = z.infer<typeof ListMediaQuerySchema>;
export type MediaPathQuery = z.infer<typeof MediaPathQuerySchema>;
