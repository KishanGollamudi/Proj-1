import type { Request, Response } from 'express';
import { paymentService } from './payment.service.js';

export const paymentController = {
  async webhook(req: Request, res: Response): Promise<void> {
    await paymentService.handleWebhookEvent(req.body as Buffer, req.header('stripe-signature') ?? undefined);
    res.status(200).json({ received: true });
  },

  async refund(req: Request, res: Response): Promise<void> {
    await paymentService.refundBooking(req.body.bookingId, req.body.reason);
    res.status(200).json({ message: 'Refund initiated' });
  }
};
