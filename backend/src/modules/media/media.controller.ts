import type { Request, Response } from 'express';
import { mediaService } from './media.service.js';

export const mediaController = {
  async upload(req: Request, res: Response): Promise<void> {
    const payload = mediaService.createCloudinaryUploadSignature(req.body);
    res.status(200).json(payload);
  },

  async registerAsset(req: Request, res: Response): Promise<void> {
    const asset = await mediaService.registerUploadedAsset(req.user!.userId, req.body);
    res.status(201).json(asset);
  }
};
