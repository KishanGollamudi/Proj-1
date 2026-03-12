import { z } from 'zod';

export const applyCreatorSchema = z.object({
  portfolioUrl: z.string().url(),
  specialties: z.array(z.string().min(2)).default([]),
  hourlyRate: z.number().positive(),
  businessName: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
  country: z.string().min(2).optional(),
  timezone: z.string().min(2).optional()
});

export const creatorFilterQuerySchema = z.object({
  q: z.string().min(2).max(300).optional(),
  location: z.string().optional(),
  specialty: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20)
});

export const creatorIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const availabilityUpdateSchema = z.object({
  isAvailable: z.boolean()
});

export const availabilityQuerySchema = z
  .object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime()
  })
  .refine((value) => new Date(value.startDate) < new Date(value.endDate), {
    message: 'startDate must be before endDate',
    path: ['endDate']
  });
