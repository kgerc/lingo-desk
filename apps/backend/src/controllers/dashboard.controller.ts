import { Response, NextFunction } from 'express';
import dashboardService from '../services/dashboard.service';
import { AuthRequest } from '../middleware/auth';

export class DashboardController {
  async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Organization ID not found',
          },
        });
        return;
      }

      const stats = await dashboardService.getDashboardStats(req.user.organizationId);

      res.json({
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async getReminders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Organization ID not found',
          },
        });
        return;
      }

      // If user is a teacher, only get their reminders
      const teacherId = req.user.role === 'TEACHER' ? req.user.id : undefined;

      const reminders = await dashboardService.getTeacherReminders(
        req.user.organizationId,
        teacherId
      );

      res.json({
        data: reminders,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new DashboardController();
