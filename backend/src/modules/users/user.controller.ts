import type { Request, Response } from 'express';
import { userService } from './user.service.js';

export const userController = {
  async profile(req: Request, res: Response): Promise<void> {
    const profile = await userService.getProfile(req.user!.userId);
    res.status(200).json(profile);
  },

  async updateProfile(req: Request, res: Response): Promise<void> {
    const profile = await userService.updateProfile(req.user!.userId, req.body);
    res.status(200).json(profile);
  },

  async bookings(req: Request, res: Response): Promise<void> {
    const bookings = await userService.getUserBookings(req.user!.userId, req.query.role as 'customer' | 'creator' | undefined);
    res.status(200).json(bookings);
  }
};
