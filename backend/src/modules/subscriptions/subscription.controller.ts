import type { Request, Response } from 'express';
import { subscriptionService } from './subscription.service.js';

export const subscriptionController = {
  async plans(_req: Request, res: Response): Promise<void> {
    res.status(200).json(subscriptionService.listPlans());
  },

  async subscribe(req: Request, res: Response): Promise<void> {
    const subscription = await subscriptionService.subscribe(req.user!.userId, req.user!.email, req.body);
    res.status(201).json(subscription);
  },

  async my(req: Request, res: Response): Promise<void> {
    const subscription = await subscriptionService.mySubscription(req.user!.userId);
    res.status(200).json(subscription);
  },

  async cancel(req: Request, res: Response): Promise<void> {
    const canceled = await subscriptionService.cancelAtPeriodEnd(req.user!.userId);
    res.status(200).json(canceled);
  },

  async topUp(req: Request, res: Response): Promise<void> {
    const updated = await subscriptionService.topUpHours(req.user!.userId, req.body);
    res.status(200).json(updated);
  },

  async webhook(req: Request, res: Response): Promise<void> {
    const result = await subscriptionService.handleWebhook(req.body as Buffer, req.header('stripe-signature') ?? undefined);
    res.status(200).json(result);
  }
};
