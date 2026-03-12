import type { Request, Response } from 'express';
import { recommendationService } from './recommendation.service.js';

export const recommendationController = {
  async list(req: Request, res: Response): Promise<void> {
    const creators = await recommendationService.forUser(req.user!.userId);
    res.status(200).json(creators);
  }
};
