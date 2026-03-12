import { z } from 'zod';

export const editorTaskIdParamSchema = z.object({
  id: z.string().uuid()
});

export const createEditorTaskSchema = z.object({
  bookingId: z.string().uuid().optional(),
  mediaAssetIds: z.array(z.string().uuid()).min(1),
  stylePreference: z.string().min(2).max(200),
  description: z.string().min(5).max(3000),
  requiredSpecialty: z.string().min(2).max(100).optional(),
  requiredSoftware: z.string().min(2).max(100).optional(),
  dueDays: z.coerce.number().int().positive().max(30).optional(),
  paymentMethodId: z.string().min(3)
});

export const editorTaskListQuerySchema = z.object({
  status: z.enum(['pending', 'assigned', 'submitted', 'changes_requested', 'completed', 'canceled']).optional(),
  bookingId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20)
});

export const submitEditorTaskSchema = z.object({
  submittedMediaUrls: z.array(z.string().url()).min(1),
  notes: z.string().max(3000).optional()
});

export const rejectEditorTaskSchema = z.object({
  revisionNotes: z.string().min(5).max(3000)
});
