import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { mediaController } from './media.controller.js';
import { registerUploadedAssetSchema, uploadSchema } from './media.schema.js';

export const mediaRouter = Router();

mediaRouter.post('/upload', authMiddleware, validateBody(uploadSchema), asyncHandler(mediaController.upload));
mediaRouter.post('/assets', authMiddleware, validateBody(registerUploadedAssetSchema), asyncHandler(mediaController.registerAsset));
