import type { Request, Response } from 'express';
import { authService } from './auth.service.js';

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const tokens = await authService.register(req.body);
    res.status(201).json(tokens);
  },

  async login(req: Request, res: Response): Promise<void> {
    const tokens = await authService.login(req.body);
    res.status(200).json(tokens);
  },

  async verifyEmail(req: Request, res: Response): Promise<void> {
    await authService.verifyEmail(req.body.token);
    res.status(200).json({ message: 'Email verified successfully' });
  },

  async forgotPassword(req: Request, res: Response): Promise<void> {
    await authService.forgotPassword(req.body.email);
    res.status(200).json({ message: 'If the email exists, a reset link has been sent' });
  },

  async resetPassword(req: Request, res: Response): Promise<void> {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    res.status(200).json({ message: 'Password reset successful' });
  },

  async refreshToken(req: Request, res: Response): Promise<void> {
    const tokens = authService.refreshToken(req.body.refreshToken);
    res.status(200).json(tokens);
  },

  async me(req: Request, res: Response): Promise<void> {
    const user = await authService.getMe(req.user!.userId);
    res.status(200).json(user);
  }
};
