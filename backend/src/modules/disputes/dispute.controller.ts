import type { Request, Response } from 'express';
import { disputeService } from './dispute.service.js';

export const disputeController = {
  async create(req: Request, res: Response): Promise<void> {
    const dispute = await disputeService.fileDispute(req.user!.userId, req.body);
    res.status(201).json(dispute);
  },

  async list(_req: Request, res: Response): Promise<void> {
    const disputes = await disputeService.listForAdmin();
    res.status(200).json(disputes);
  },

  async resolve(req: Request, res: Response): Promise<void> {
    const resolved = await disputeService.resolve(req.params.id as string, req.user!.userId, req.body);
    res.status(200).json(resolved);
  }
};
