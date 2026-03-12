import { z } from 'zod';

export const createDisputeSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(3).max(300),
  details: z.string().max(4000).optional()
});

export const disputeIdParamSchema = z.object({
  id: z.string().uuid()
});

export const resolveDisputeSchema = z.object({
  resolutionNotes: z.string().min(3).max(4000),
  refundPercent: z.coerce.number().min(0).max(100).optional()
});
