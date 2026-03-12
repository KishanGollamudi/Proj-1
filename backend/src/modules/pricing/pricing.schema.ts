import { z } from 'zod';

export const pricingEstimateQuerySchema = z.object({
  creatorId: z.string().uuid(),
  datetime: z.string().datetime()
});

export const createPricingEventSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(2).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  multiplier: z.coerce.number().min(1).max(5)
});
