import { Response, NextFunction } from 'express';
import dashboardService, { DateRangeType } from '../services/dashboard.service';
import { AuthRequest } from '../middleware/auth';

export class DashboardController {
  async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Nie znaleziono ID organizacji',
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

  async getChartData(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Nie znaleziono ID organizacji',
          },
        });
        return;
      }

      const { rangeType, year, month } = req.query;

      // Validate rangeType
      const validRangeTypes: DateRangeType[] = ['last30days', 'month', 'year'];
      const range = (rangeType as DateRangeType) || 'last30days';

      if (!validRangeTypes.includes(range)) {
        res.status(400).json({
          error: {
            code: 'INVALID_RANGE_TYPE',
            message: 'Invalid range type. Must be one of: last30days, month, year',
          },
        });
        return;
      }

      const chartData = await dashboardService.getChartData({
        organizationId: req.user.organizationId,
        rangeType: range,
        year: year ? parseInt(year as string, 10) : undefined,
        month: month ? parseInt(month as string, 10) : undefined,
      });

      res.json({
        data: chartData,
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
            message: 'Nie znaleziono ID organizacji',
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
