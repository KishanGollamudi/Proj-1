import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(5).max(20).optional(),
  profileImage: z.string().url().optional()
});

export const userBookingsQuerySchema = z.object({
  role: z.enum(['customer', 'creator']).optional()
});
