import { z } from 'zod';

export const UploadFileSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  base64Data: z.string().min(1, 'Base64 data is required'),
});
