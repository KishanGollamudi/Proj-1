import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/require-role.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { disputeController } from './dispute.controller.js';
import { createDisputeSchema, disputeIdParamSchema, resolveDisputeSchema } from './dispute.schema.js';

export const disputeRouter = Router();

disputeRouter.post('/', authMiddleware, requireRole('CUSTOMER', 'CREATOR'), validateBody(createDisputeSchema), asyncHandler(disputeController.create));
disputeRouter.get('/', authMiddleware, requireRole('ADMIN'), asyncHandler(disputeController.list));
disputeRouter.post(
  '/:id/resolve',
  authMiddleware,
  requireRole('ADMIN'),
  validateParams(disputeIdParamSchema),
  validateBody(resolveDisputeSchema),
  asyncHandler(disputeController.resolve)
);
