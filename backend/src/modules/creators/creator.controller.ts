import type { Request, Response } from 'express';
import { creatorService } from './creator.service.js';

export const creatorController = {
  async apply(req: Request, res: Response): Promise<void> {
    const data = await creatorService.apply(req.user!.userId, req.user!.email, req.body);
    res.status(201).json(data);
  },

  async list(req: Request, res: Response): Promise<void> {
    const creators = await creatorService.list(req.query as never);
    res.status(200).json(creators);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const creator = await creatorService.getById(req.params.id as string);
    res.status(200).json(creator);
  },

  async updateAvailability(req: Request, res: Response): Promise<void> {
    const updated = await creatorService.updateAvailability(req.user!.userId, req.body.isAvailable);
    res.status(200).json(updated);
  },

  async getAvailability(req: Request, res: Response): Promise<void> {
    const payload = await creatorService.getAvailability(
      req.params.id as string,
      new Date(req.query.startDate as string),
      new Date(req.query.endDate as string)
    );

    res.status(200).json(payload);
  },

  async reviews(req: Request, res: Response): Promise<void> {
    const reviews = await creatorService.getReviews(req.params.id as string);
    res.status(200).json(reviews);
  }
};
