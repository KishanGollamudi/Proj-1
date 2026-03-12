import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/require-role.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { editorController } from './editor.controller.js';
import {
  applyEditorSchema,
  editorAvailabilityUpdateSchema,
  editorFilterQuerySchema,
  editorIdParamsSchema
} from './editor.schema.js';

export const editorRouter = Router();

editorRouter.post('/apply', authMiddleware, validateBody(applyEditorSchema), asyncHandler(editorController.apply));
editorRouter.get('/', validateQuery(editorFilterQuerySchema), asyncHandler(editorController.list));
editorRouter.get('/:id', validateParams(editorIdParamsSchema), asyncHandler(editorController.getById));
editorRouter.put(
  '/availability',
  authMiddleware,
  requireRole('EDITOR'),
  validateBody(editorAvailabilityUpdateSchema),
  asyncHandler(editorController.updateAvailability)
);
