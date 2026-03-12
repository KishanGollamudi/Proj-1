import { z } from 'zod';

export const adminUsersQuerySchema = z.object({
  role: z.enum(['CUSTOMER', 'CREATOR', 'EDITOR', 'ADMIN']).optional(),
  verificationStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const adminCreatorsQuerySchema = z.object({
  applicationStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  featured: z.coerce.boolean().optional()
});

export const adminEditorsQuerySchema = z.object({
  applicationStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  featured: z.coerce.boolean().optional()
});

export const adminBookingsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'REQUESTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'DISPUTED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const adminTransactionsQuerySchema = z.object({
  type: z.enum(['BOOKING_PAYMENT', 'BOOKING_REFUND', 'EDITOR_PAYOUT', 'PLATFORM_FEE', 'SUBSCRIPTION_CHARGE', 'SUBSCRIPTION_REFUND']).optional(),
  status: z.enum(['PENDING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'CANCELED', 'REFUNDED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const adminIdParamSchema = z.object({
  id: z.string().uuid()
});

export const reviewApplicationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED'])
});

export const featureToggleSchema = z.object({
  featured: z.boolean()
});

export const analyticsQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  metrics: z.string().optional()
});

export const settingsUpdateSchema = z.object({
  commissionPercent: z.coerce.number().min(0).max(100).optional(),
  surgeParams: z.record(z.unknown()).optional(),
  emailTemplates: z.record(z.unknown()).optional()
});
