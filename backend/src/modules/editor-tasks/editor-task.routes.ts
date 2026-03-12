import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';
import { requireRole } from '../../middleware/require-role.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { editorTaskController } from './editor-task.controller.js';
import {
  createEditorTaskSchema,
  editorTaskIdParamSchema,
  editorTaskListQuerySchema,
  rejectEditorTaskSchema,
  submitEditorTaskSchema
} from './editor-task.schema.js';

export const editorTaskRouter = Router();

editorTaskRouter.post(
  '/',
  authMiddleware,
  requireRole('CUSTOMER'),
  idempotencyMiddleware,
  validateBody(createEditorTaskSchema),
  asyncHandler(editorTaskController.create)
);
editorTaskRouter.get(
  '/',
  authMiddleware,
  requireRole('CUSTOMER', 'EDITOR', 'ADMIN'),
  validateQuery(editorTaskListQuerySchema),
  asyncHandler(editorTaskController.list)
);
editorTaskRouter.get(
  '/:id',
  authMiddleware,
  requireRole('CUSTOMER', 'EDITOR', 'ADMIN'),
  validateParams(editorTaskIdParamSchema),
  asyncHandler(editorTaskController.getById)
);
editorTaskRouter.put(
  '/:id/assign',
  authMiddleware,
  requireRole('EDITOR'),
  validateParams(editorTaskIdParamSchema),
  asyncHandler(editorTaskController.assign)
);
editorTaskRouter.put(
  '/:id/submit',
  authMiddleware,
  requireRole('EDITOR'),
  validateParams(editorTaskIdParamSchema),
  validateBody(submitEditorTaskSchema),
  asyncHandler(editorTaskController.submit)
);
editorTaskRouter.post(
  '/:id/approve',
  authMiddleware,
  requireRole('CUSTOMER'),
  validateParams(editorTaskIdParamSchema),
  asyncHandler(editorTaskController.approve)
);
editorTaskRouter.post(
  '/:id/reject',
  authMiddleware,
  requireRole('CUSTOMER'),
  validateParams(editorTaskIdParamSchema),
  validateBody(rejectEditorTaskSchema),
  asyncHandler(editorTaskController.reject)
);
