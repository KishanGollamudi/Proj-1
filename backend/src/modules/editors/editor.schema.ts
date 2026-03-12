import { z } from 'zod';

export const applyEditorSchema = z.object({
  bio: z.string().max(3000).optional(),
  specialties: z.array(z.string().min(2)).min(1),
  software: z.array(z.string().min(2)).min(1),
  hourlyRate: z.coerce.number().positive(),
  portfolioUrl: z.string().url().optional(),
  turnaroundHours: z.coerce.number().int().positive().max(720).optional()
});

export const editorFilterQuerySchema = z.object({
  specialty: z.string().optional(),
  software: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20)
});

export const editorIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const editorAvailabilityUpdateSchema = z.object({
  isAvailable: z.boolean()
});
