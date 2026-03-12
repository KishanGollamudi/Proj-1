import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/require-role.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { creatorController } from './creator.controller.js';
import {
  applyCreatorSchema,
  availabilityQuerySchema,
  availabilityUpdateSchema,
  creatorFilterQuerySchema,
  creatorIdParamsSchema
} from './creator.schema.js';

export const creatorRouter = Router();

creatorRouter.post('/apply', authMiddleware, validateBody(applyCreatorSchema), asyncHandler(creatorController.apply));
creatorRouter.get('/', validateQuery(creatorFilterQuerySchema), asyncHandler(creatorController.list));
creatorRouter.get('/:id', validateParams(creatorIdParamsSchema), asyncHandler(creatorController.getById));
creatorRouter.put(
  '/availability',
  authMiddleware,
  requireRole('CREATOR'),
  validateBody(availabilityUpdateSchema),
  asyncHandler(creatorController.updateAvailability)
);
creatorRouter.get(
  '/:id/availability',
  validateParams(creatorIdParamsSchema),
  validateQuery(availabilityQuerySchema),
  asyncHandler(creatorController.getAvailability)
);
creatorRouter.get('/:id/reviews', validateParams(creatorIdParamsSchema), asyncHandler(creatorController.reviews));
