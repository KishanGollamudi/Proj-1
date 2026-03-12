import { z } from 'zod';

export const createBookingSchema = z.object({
  creatorId: z.string().uuid(),
  eventDate: z.string().datetime(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationHours: z.number().positive().max(24),
  location: z.string().min(2),
  specialInstructions: z.string().max(2000).optional(),
  paymentMethodId: z.string().min(3).optional(),
  useSubscriptionCredits: z.boolean().default(false)
});

export const bookingListQuerySchema = z.object({
  role: z.enum(['customer', 'creator']).optional()
});

export const bookingIdParamSchema = z.object({
  id: z.string().uuid()
});

export const cancelBookingSchema = z.object({
  reason: z.string().min(2).optional()
});
