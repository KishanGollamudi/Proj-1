import { z } from 'zod';

export const subscribeSchema = z.object({
  plan: z.enum(['BASIC', 'PRO', 'UNLIMITED']),
  paymentMethodId: z.string().min(3).optional()
});

export const topUpSchema = z.object({
  hours: z.coerce.number().positive().max(100),
  paymentMethodId: z.string().min(3)
});
