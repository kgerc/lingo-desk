import { Response, NextFunction } from 'express';
import { z } from 'zod';
import userProfileService from '../services/userProfile.service';
import { AuthRequest } from '../middleware/auth';

const updateProfileSchema = z.object({
  dateOfBirth: z
    .string()
    .optional()
    .transform((str) => (str ? new Date(str) : undefined)),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  notes: z.string().optional(),
  languagePreference: z.string().optional(),
});

const updateNotificationPreferencesSchema = z.object({
  emailReminders: z.boolean().optional(),
  emailConfirmations: z.boolean().optional(),
  emailCancellations: z.boolean().optional(),
  emailPayments: z.boolean().optional(),
  emailLowBudget: z.boolean().optional(),
  smsReminders: z.boolean().optional(),
  inAppNotifications: z.boolean().optional(),
});

class UserProfileController {
  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const profile = await userProfileService.getProfile(req.user.id);
      res.json({ message: 'Profile retrieved successfully', data: profile });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = updateProfileSchema.parse(req.body);
      const profile = await userProfileService.updateProfile(req.user.id, data);
      res.json({ message: 'Profile updated successfully', data: profile });
    } catch (error) {
      next(error);
    }
  }

  async getNotificationPreferences(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const preferences = await userProfileService.getNotificationPreferences(req.user.id);
      res.json({ message: 'Notification preferences retrieved successfully', data: preferences });
    } catch (error) {
      next(error);
    }
  }

  async updateNotificationPreferences(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const preferences = updateNotificationPreferencesSchema.parse(req.body);
      const profile = await userProfileService.updateNotificationPreferences(req.user.id, preferences);
      res.json({ message: 'Notification preferences updated successfully', data: profile });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserProfileController();
