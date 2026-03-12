import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { recommendationController } from './recommendation.controller.js';

export const recommendationRouter = Router();

recommendationRouter.get('/', authMiddleware, asyncHandler(recommendationController.list));
