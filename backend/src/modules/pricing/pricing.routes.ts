import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/require-role.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { pricingController } from './pricing.controller.js';
import { createPricingEventSchema, pricingEstimateQuerySchema } from './pricing.schema.js';

export const pricingRouter = Router();

pricingRouter.get('/estimate', validateQuery(pricingEstimateQuerySchema), asyncHandler(pricingController.estimate));
pricingRouter.get('/events', authMiddleware, requireRole('ADMIN'), asyncHandler(pricingController.listEvents));
pricingRouter.post(
  '/events',
  authMiddleware,
  requireRole('ADMIN'),
  validateBody(createPricingEventSchema),
  asyncHandler(pricingController.createEvent)
);
