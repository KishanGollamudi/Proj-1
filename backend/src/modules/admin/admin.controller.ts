import type { Request, Response } from 'express';
import { adminService } from './admin.service.js';

export const adminController = {
  async kpis(_req: Request, res: Response): Promise<void> {
    const payload = await adminService.getKpis();
    res.status(200).json(payload);
  },

  async users(req: Request, res: Response): Promise<void> {
    const users = await adminService.listUsers(req.query as never);
    res.status(200).json(users);
  },

  async verifyUser(req: Request, res: Response): Promise<void> {
    const user = await adminService.verifyUser(req.params.id as string);
    res.status(200).json(user);
  },

  async suspendUser(req: Request, res: Response): Promise<void> {
    const user = await adminService.suspendUser(req.params.id as string);
    res.status(200).json(user);
  },

  async deleteUser(req: Request, res: Response): Promise<void> {
    const user = await adminService.softDeleteUser(req.params.id as string);
    res.status(200).json(user);
  },

  async creators(req: Request, res: Response): Promise<void> {
    const creators = await adminService.listCreators(req.query as never);
    res.status(200).json(creators);
  },

  async reviewCreator(req: Request, res: Response): Promise<void> {
    const creator = await adminService.reviewCreator(req.params.id as string, req.body.status);
    res.status(200).json(creator);
  },

  async featureCreator(req: Request, res: Response): Promise<void> {
    const creator = await adminService.setCreatorFeatured(req.params.id as string, req.body.featured);
    res.status(200).json(creator);
  },

  async editors(req: Request, res: Response): Promise<void> {
    const editors = await adminService.listEditors(req.query as never);
    res.status(200).json(editors);
  },

  async reviewEditor(req: Request, res: Response): Promise<void> {
    const editor = await adminService.reviewEditor(req.params.id as string, req.body.status);
    res.status(200).json(editor);
  },

  async featureEditor(req: Request, res: Response): Promise<void> {
    const editor = await adminService.setEditorFeatured(req.params.id as string, req.body.featured);
    res.status(200).json(editor);
  },

  async bookings(req: Request, res: Response): Promise<void> {
    const bookings = await adminService.listBookings(req.query as never);
    res.status(200).json(bookings);
  },

  async transactions(req: Request, res: Response): Promise<void> {
    const tx = await adminService.listTransactions(req.query as never);
    res.status(200).json(tx);
  },

  async analytics(req: Request, res: Response): Promise<void> {
    const report = await adminService.analyticsReport(req.query as never);
    res.status(200).json(report);
  },

  async settings(_req: Request, res: Response): Promise<void> {
    const settings = await adminService.getSettings();
    res.status(200).json(settings);
  },

  async updateSettings(req: Request, res: Response): Promise<void> {
    const settings = await adminService.updateSettings(req.body);
    res.status(200).json(settings);
  }
};
