import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { alertService } from '../services/alert.service';
import { AlertPriority, UserRole } from '@prisma/client';

class AlertController {
  async getAlerts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const isRead = req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined;
      const priorityValues = Object.values(AlertPriority) as string[];
      const priority = priorityValues.includes(req.query.priority as string)
        ? (req.query.priority as AlertPriority)
        : undefined;

      const result = await alertService.getAlerts(
        req.user.organizationId,
        req.user.id,
        { page, limit, isRead, priority, userRole: req.user.role as UserRole }
      );

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      const count = await alertService.getUnreadCount(req.user.organizationId, req.user.id, req.user.role as UserRole);

      res.json({ data: { count } });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      const { id  } = req.params ;
      const alert = await alertService.markAsRead(id as string, req.user.organizationId);

      res.json({ data: alert });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      await alertService.markAllAsRead(req.user.organizationId, req.user.id, req.user.role as UserRole);

      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }

  async generateSystemAlerts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      const alerts = await alertService.generateSystemAlerts(req.user.organizationId);

      res.json({ data: alerts });
    } catch (error) {
      next(error);
    }
  }
}

export const alertController = new AlertController();
