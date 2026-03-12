import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { authController } from './auth.controller.js';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema
} from './auth.schema.js';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), asyncHandler(authController.register));
authRouter.post('/login', validateBody(loginSchema), asyncHandler(authController.login));
authRouter.post('/verify-email', validateBody(verifyEmailSchema), asyncHandler(authController.verifyEmail));
authRouter.post('/forgot-password', validateBody(forgotPasswordSchema), asyncHandler(authController.forgotPassword));
authRouter.post('/reset-password', validateBody(resetPasswordSchema), asyncHandler(authController.resetPassword));
authRouter.post('/refresh-token', validateBody(refreshTokenSchema), asyncHandler(authController.refreshToken));
authRouter.get('/me', authMiddleware, asyncHandler(authController.me));
