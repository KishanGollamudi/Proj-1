import { z } from 'zod';

export const refundSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(2).optional()
});
