import { z } from 'zod';

export const ConfigurationKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(
    /^[a-z][a-z0-9_.-]*$/,
    'Use lowercase letters, digits, ".", "-" and "_", starting with a letter'
  );

export const UpsertConfigurationSchema = z
  .object({
    key: ConfigurationKeySchema,
    // Omit `value` on an encrypted entry to keep the stored secret unchanged.
    value: z.string().min(1, 'Value is required').max(10_000).optional(),
    category: z.string().trim().max(60).nullable().optional(),
    isEncrypted: z.boolean().default(false),
  })
  .strict();

export const ConfigurationListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  /** Omitted: category, then key. */
  sort: z.enum(['key', 'category', 'updatedAt']).optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const KeyParamSchema = z.object({ key: ConfigurationKeySchema });

export type UpsertConfigurationDto = z.infer<typeof UpsertConfigurationSchema>;
export type ConfigurationListQuery = z.infer<typeof ConfigurationListQuerySchema>;
