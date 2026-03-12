import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import { editorTaskService } from './editor-task.service.js';

export const editorTaskController = {
  async create(req: Request, res: Response): Promise<void> {
    if (!req.idempotencyKey) {
      throw new AppError('Idempotency key missing', 400);
    }

    const task = await editorTaskService.create(req.user!.userId, req.body, req.idempotencyKey);
    res.status(201).json(task);
  },

  async list(req: Request, res: Response): Promise<void> {
    const tasks = await editorTaskService.listForUser(req.user!.userId, req.user!.role, req.query as never);
    res.status(200).json(tasks);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const task = await editorTaskService.getById(req.user!.userId, req.user!.role, req.params.id as string);
    res.status(200).json(task);
  },

  async assign(req: Request, res: Response): Promise<void> {
    const task = await editorTaskService.assign(req.params.id as string, req.user!.userId);
    res.status(200).json(task);
  },

  async submit(req: Request, res: Response): Promise<void> {
    const task = await editorTaskService.submit(req.params.id as string, req.user!.userId, req.body);
    res.status(200).json(task);
  },

  async approve(req: Request, res: Response): Promise<void> {
    const task = await editorTaskService.approve(req.params.id as string, req.user!.userId);
    res.status(200).json(task);
  },

  async reject(req: Request, res: Response): Promise<void> {
    const task = await editorTaskService.reject(req.params.id as string, req.user!.userId, req.body.revisionNotes);
    res.status(200).json(task);
  }
};
