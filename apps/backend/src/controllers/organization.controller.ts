import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { organizationService, UpdateOrganizationData, CreateOrganizationData, UpdateOrganizationSettingsData, VisibilitySettings } from '../services/organization.service';
import { getPolishHolidays, getHolidayName } from '../utils/polish-holidays';

class OrganizationController {
  async getOrganization(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const organization = await organizationService.getOrganizationById(organizationId);

      res.json({
        success: true,
        data: organization,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserOrganizations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const organizations = await organizationService.getUserOrganizations(userId);

      res.json({
        success: true,
        data: organizations,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateOrganization(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const data: UpdateOrganizationData = req.body;
      const userId = req.user!.id;

      const organization = await organizationService.updateOrganization(organizationId, data, userId);

      res.json({
        success: true,
        data: organization,
      });
    } catch (error) {
      next(error);
    }
  }

  async createOrganization(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreateOrganizationData = req.body;
      const userId = req.user!.id;

      const organization = await organizationService.createOrganization(data, userId);

      res.status(201).json({
        success: true,
        data: organization,
      });
    } catch (error) {
      next(error);
    }
  }

  async switchOrganization(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { organizationId } = req.body;
      const userId = req.user!.id;

      if (!organizationId) {
        res.status(400).json({
          success: false,
          error: { message: 'Pole "Organizacja" jest wymagane' },
        });
        return;
      }

      const userOrganization = await organizationService.switchOrganization(userId, organizationId);

      res.json({
        success: true,
        data: userOrganization,
      });
    } catch (error) {
      next(error);
    }
  }

  async addUserToOrganization(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const { userId, role } = req.body;
      const requestingUserId = req.user!.id;

      if (!userId || !role) {
        res.status(400).json({
          success: false,
          error: { message: 'Pola "Użytkownik" i "Rola" są wymagane' },
        });
        return;
      }

      const userOrganization = await organizationService.addUserToOrganization(
        organizationId,
        userId,
        role,
        requestingUserId
      );

      res.status(201).json({
        success: true,
        data: userOrganization,
      });
    } catch (error) {
      next(error);
    }
  }

  async removeUserFromOrganization(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const { userId } = req.params;
      const requestingUserId = req.user!.id;

      const result = await organizationService.removeUserFromOrganization(
        organizationId,
        userId as string,
        requestingUserId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrganizationSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const organization = await organizationService.getOrganizationById(organizationId);

      res.json({
        success: true,
        data: organization.settings ?? null,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateOrganizationSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const data: UpdateOrganizationSettingsData = req.body;
      const userId = req.user!.id;

      const settings = await organizationService.updateOrganizationSettings(organizationId, data, userId);

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRegulations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const regulations = await organizationService.getRegulations(organizationId);
      res.json({ success: true, data: regulations });
    } catch (error) {
      next(error);
    }
  }

  async updateRegulations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const { regulationsContent } = req.body;
      const userId = req.user!.id;

      const regulations = await organizationService.updateRegulations(
        organizationId,
        regulationsContent ?? null,
        userId
      );
      res.json({ success: true, data: regulations });
    } catch (error) {
      next(error);
    }
  }

  async getVisibilitySettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const visibility = await organizationService.getVisibilitySettings(organizationId);

      res.json({
        success: true,
        data: visibility,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateVisibilitySettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const visibility: VisibilitySettings = req.body;
      const userId = req.user!.id;

      const settings = await organizationService.updateVisibilitySettings(organizationId, visibility, userId);

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  }
  async getSkipHolidays(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const skipHolidays = await organizationService.getSkipHolidays(organizationId);

      res.json({
        success: true,
        data: { skipHolidays },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateSkipHolidays(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const { skipHolidays } = req.body;
      const userId = req.user!.id;

      if (typeof skipHolidays !== 'boolean') {
        res.status(400).json({
          success: false,
          error: { message: 'Pole "skipHolidays" musi być typu boolean' },
        });
        return;
      }

      const settings = await organizationService.updateSkipHolidays(organizationId, skipHolidays, userId);

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  }

  async getHolidays(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const year = req.query.year ? parseInt(String(req.query.year), 10) : new Date().getFullYear();
      const holidays = getPolishHolidays(year);

      res.json({
        success: true,
        data: holidays.map(h => ({
          date: h.date.toISOString(),
          name: h.name,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  async getDisabledHolidays(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const disabledHolidays = await organizationService.getDisabledHolidays(organizationId);

      res.json({ success: true, data: { disabledHolidays } });
    } catch (error) {
      next(error);
    }
  }

  async updateDisabledHolidays(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user!.organizationId;
      const { disabledHolidays } = req.body;
      const userId = req.user!.id;

      if (!Array.isArray(disabledHolidays) || disabledHolidays.some(h => typeof h !== 'string')) {
        res.status(400).json({
          success: false,
          error: { message: 'Pole "disabledHolidays" musi być tablicą ciągów znaków' },
        });
        return;
      }

      await organizationService.updateDisabledHolidays(organizationId, disabledHolidays, userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async checkHoliday(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { date } = req.query;

      if (!date) {
        res.status(400).json({
          success: false,
          error: { message: 'Parametr "date" jest wymagany' },
        });
        return;
      }

      const checkDate = new Date(String(date));
      const holidayName = getHolidayName(checkDate);

      res.json({
        success: true,
        data: {
          isHoliday: holidayName !== null,
          holidayName,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const organizationController = new OrganizationController();
