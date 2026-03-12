import type { Request, Response } from 'express';
import { editorService } from './editor.service.js';

export const editorController = {
  async apply(req: Request, res: Response): Promise<void> {
    const editor = await editorService.apply(req.user!.userId, req.user!.email, req.body);
    res.status(201).json(editor);
  },

  async list(req: Request, res: Response): Promise<void> {
    const editors = await editorService.list(req.query as never);
    res.status(200).json(editors);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const editor = await editorService.getById(req.params.id as string);
    res.status(200).json(editor);
  },

  async updateAvailability(req: Request, res: Response): Promise<void> {
    const updated = await editorService.updateAvailability(req.user!.userId, req.body.isAvailable);
    res.status(200).json(updated);
  }
};
