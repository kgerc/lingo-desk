import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { alertService } from '../services/alert.service';

class AlertController {
  async getAlerts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.organizationId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
        return;
      }

      const alerts = await alertService.getOrganizationAlerts(req.user.organizationId);

      res.json({ data: alerts });
    } catch (error) {
      next(error);
    }
  }
}

export const alertController = new AlertController();
