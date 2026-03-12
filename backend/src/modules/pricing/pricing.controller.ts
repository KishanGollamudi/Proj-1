import type { Request, Response } from 'express';
import { pricingService } from './pricing.service.js';

export const pricingController = {
  async estimate(req: Request, res: Response): Promise<void> {
    const result = await pricingService.estimate(req.query.creatorId as string, new Date(req.query.datetime as string));
    res.status(200).json(result);
  },

  async listEvents(_req: Request, res: Response): Promise<void> {
    const events = await pricingService.listEvents();
    res.status(200).json(events);
  },

  async createEvent(req: Request, res: Response): Promise<void> {
    const event = await pricingService.createEvent(req.body);
    res.status(201).json(event);
  }
};
