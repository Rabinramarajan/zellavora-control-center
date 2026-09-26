import { z } from 'zod';

export const UploadFileSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  base64Data: z.string().min(1, 'Base64 data is required'),
});

export const ListMediaQuerySchema = z.object({
  prefix: z.string().trim().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export const MediaPathQuerySchema = z.object({
  pathname: z.string().trim().min(1, 'pathname is required'),
  access: z.enum(['public', 'private']).default('public'),
});

export type ListMediaQuery = z.infer<typeof ListMediaQuerySchema>;
export type MediaPathQuery = z.infer<typeof MediaPathQuerySchema>;
