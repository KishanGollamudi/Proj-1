import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { userController } from './user.controller.js';
import { updateProfileSchema, userBookingsQuerySchema } from './user.schema.js';

export const userRouter = Router();

userRouter.use(authMiddleware);

userRouter.get('/profile', asyncHandler(userController.profile));
userRouter.put('/profile', validateBody(updateProfileSchema), asyncHandler(userController.updateProfile));
userRouter.get('/bookings', validateQuery(userBookingsQuerySchema), asyncHandler(userController.bookings));
