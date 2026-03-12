import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';
import { requireRole } from '../../middleware/require-role.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { bookingController } from './booking.controller.js';
import { bookingIdParamSchema, bookingListQuerySchema, cancelBookingSchema, createBookingSchema } from './booking.schema.js';

export const bookingRouter = Router();

bookingRouter.post(
  '/',
  authMiddleware,
  requireRole('CUSTOMER'),
  idempotencyMiddleware,
  validateBody(createBookingSchema),
  asyncHandler(bookingController.create)
);
bookingRouter.get('/', authMiddleware, validateQuery(bookingListQuerySchema), asyncHandler(bookingController.list));
bookingRouter.get('/:id', authMiddleware, validateParams(bookingIdParamSchema), asyncHandler(bookingController.getById));
bookingRouter.put(
  '/:id/cancel',
  authMiddleware,
  validateParams(bookingIdParamSchema),
  validateBody(cancelBookingSchema),
  asyncHandler(bookingController.cancel)
);
bookingRouter.post('/:id/confirm', validateParams(bookingIdParamSchema), asyncHandler(bookingController.confirm));
bookingRouter.post('/:id/complete', authMiddleware, validateParams(bookingIdParamSchema), asyncHandler(bookingController.complete));
