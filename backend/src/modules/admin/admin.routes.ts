import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/require-role.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { adminController } from './admin.controller.js';
import {
  adminBookingsQuerySchema,
  adminCreatorsQuerySchema,
  adminEditorsQuerySchema,
  adminIdParamSchema,
  adminTransactionsQuerySchema,
  adminUsersQuerySchema,
  analyticsQuerySchema,
  featureToggleSchema,
  reviewApplicationSchema,
  settingsUpdateSchema
} from './admin.schema.js';

export const adminRouter = Router();
adminRouter.use(authMiddleware, requireRole('ADMIN'));

adminRouter.get('/kpis', asyncHandler(adminController.kpis));

adminRouter.get('/users', validateQuery(adminUsersQuerySchema), asyncHandler(adminController.users));
adminRouter.post('/users/:id/verify', validateParams(adminIdParamSchema), asyncHandler(adminController.verifyUser));
adminRouter.post('/users/:id/suspend', validateParams(adminIdParamSchema), asyncHandler(adminController.suspendUser));
adminRouter.delete('/users/:id', validateParams(adminIdParamSchema), asyncHandler(adminController.deleteUser));

adminRouter.get('/creators', validateQuery(adminCreatorsQuerySchema), asyncHandler(adminController.creators));
adminRouter.post('/creators/:id/review', validateParams(adminIdParamSchema), validateBody(reviewApplicationSchema), asyncHandler(adminController.reviewCreator));
adminRouter.post('/creators/:id/featured', validateParams(adminIdParamSchema), validateBody(featureToggleSchema), asyncHandler(adminController.featureCreator));

adminRouter.get('/editors', validateQuery(adminEditorsQuerySchema), asyncHandler(adminController.editors));
adminRouter.post('/editors/:id/review', validateParams(adminIdParamSchema), validateBody(reviewApplicationSchema), asyncHandler(adminController.reviewEditor));
adminRouter.post('/editors/:id/featured', validateParams(adminIdParamSchema), validateBody(featureToggleSchema), asyncHandler(adminController.featureEditor));

adminRouter.get('/bookings', validateQuery(adminBookingsQuerySchema), asyncHandler(adminController.bookings));
adminRouter.get('/transactions', validateQuery(adminTransactionsQuerySchema), asyncHandler(adminController.transactions));
adminRouter.get('/analytics', validateQuery(analyticsQuerySchema), asyncHandler(adminController.analytics));

adminRouter.get('/settings', asyncHandler(adminController.settings));
adminRouter.put('/settings', validateBody(settingsUpdateSchema), asyncHandler(adminController.updateSettings));
