import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { organizationService, UpdateOrganizationData, CreateOrganizationData, UpdateOrganizationSettingsData, VisibilitySettings } from '../services/organization.service';

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
}

export const organizationController = new OrganizationController();
