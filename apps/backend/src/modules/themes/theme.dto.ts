import { z } from 'zod';

/** Fonts the client knows how to load; anything else would silently fall back. */
export const THEME_FONTS = [
  'Outfit',
  'Inter',
  'Roboto',
  'Poppins',
  'Montserrat',
  'Source Sans 3',
  'IBM Plex Sans',
  'System',
] as const;

export const ThemeModeSchema = z.enum(['light', 'dark']);
const Hex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like #4F46E5')
  .transform((v) => v.toUpperCase());
const HttpsUrl = z
  .string()
  .trim()
  .max(1000)
  .url('Enter a valid URL')
  .refine((v) => v.startsWith('https://'), 'Use an https:// URL');

const ThemeFields = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  description: z.string().trim().max(300).nullable().optional(),
  primaryColor: Hex,
  secondaryColor: Hex,
  accentColor: Hex,
  fontFamily: z.enum(THEME_FONTS),
  borderRadius: z.coerce.number().int().min(0, 'Minimum 0').max(24, 'Maximum 24'),
  mode: ThemeModeSchema,
  logoUrl: HttpsUrl.nullable().optional(),
  faviconUrl: HttpsUrl.nullable().optional(),
};

export const CreateThemeSchema = z.object(ThemeFields).strict();
export const UpdateThemeSchema = z
  .object({ ...ThemeFields, version: z.number().int().min(1) })
  .partial()
  .strict();

export const DuplicateThemeSchema = z.object({ name: ThemeFields.name }).strict();

export const ThemeListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  mode: ThemeModeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['name', 'updatedAt', 'createdAt']).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateThemeDto = z.infer<typeof CreateThemeSchema>;
export type UpdateThemeDto = z.infer<typeof UpdateThemeSchema>;
export type ThemeListQueryDto = z.infer<typeof ThemeListQuerySchema>;
