import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/require-role.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { paymentController } from './payment.controller.js';
import { refundSchema } from './payment.schema.js';

export const paymentRouter = Router();

paymentRouter.post('/refund', authMiddleware, requireRole('ADMIN'), validateBody(refundSchema), asyncHandler(paymentController.refund));
