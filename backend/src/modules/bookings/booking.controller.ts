import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import { bookingService } from './booking.service.js';

export const bookingController = {
  async create(req: Request, res: Response): Promise<void> {
    if (!req.idempotencyKey) {
      throw new AppError('Idempotency key missing', 400);
    }

    const booking = await bookingService.create(req.user!.userId, req.body, req.idempotencyKey);
    res.status(201).json(booking);
  },

  async list(req: Request, res: Response): Promise<void> {
    const bookings = await bookingService.listByUser(req.user!.userId, req.query.role as 'customer' | 'creator' | undefined);
    res.status(200).json(bookings);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const booking = await bookingService.getById(req.user!.userId, req.params.id as string);
    res.status(200).json(booking);
  },

  async cancel(req: Request, res: Response): Promise<void> {
    const canceled = await bookingService.cancel(req.user!.userId, req.params.id as string, req.body.reason);
    res.status(200).json(canceled);
  },

  async confirm(req: Request, res: Response): Promise<void> {
    const confirmed = await bookingService.confirm(req.params.id as string);
    res.status(200).json(confirmed);
  },

  async complete(req: Request, res: Response): Promise<void> {
    const completed = await bookingService.complete(req.user!.userId, req.params.id as string);
    res.status(200).json(completed);
  }
};
