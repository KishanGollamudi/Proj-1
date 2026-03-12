import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { subscriptionController } from './subscription.controller.js';
import { subscribeSchema, topUpSchema } from './subscription.schema.js';

export const subscriptionRouter = Router();

subscriptionRouter.get('/plans', asyncHandler(subscriptionController.plans));
subscriptionRouter.post('/subscribe', authMiddleware, validateBody(subscribeSchema), asyncHandler(subscriptionController.subscribe));
subscriptionRouter.get('/my', authMiddleware, asyncHandler(subscriptionController.my));
subscriptionRouter.put('/cancel', authMiddleware, asyncHandler(subscriptionController.cancel));
subscriptionRouter.post('/top-up', authMiddleware, validateBody(topUpSchema), asyncHandler(subscriptionController.topUp));
