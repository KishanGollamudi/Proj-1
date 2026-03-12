import { z } from 'zod';

export const uploadSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(3),
  folder: z.string().default('snapmatch/uploads')
});

export const registerUploadedAssetSchema = z.object({
  bookingId: z.string().uuid(),
  fileName: z.string().min(1),
  mimeType: z.string().min(3),
  sizeBytes: z.coerce.number().int().positive(),
  originalUrl: z.string().url(),
  transformedUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional()
});
