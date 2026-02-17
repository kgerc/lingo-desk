import { Response, NextFunction } from 'express';
import { z } from 'zod';
import userProfileService from '../services/userProfile.service';
import { AuthRequest } from '../middleware/auth';
import { optionalString, optionalBoolean } from '../utils/validation-messages';

const updateProfileSchema = z.object({
  address: optionalString('Adres'),
  emergencyContact: optionalString('Kontakt awaryjny'),
  notes: optionalString('Notatki'),
  languagePreference: optionalString('Preferowany język'),
});

const updateNotificationPreferencesSchema = z.object({
  emailReminders: optionalBoolean('Przypomnienia email'),
  emailConfirmations: optionalBoolean('Potwierdzenia email'),
  emailCancellations: optionalBoolean('Anulowania email'),
  emailPayments: optionalBoolean('Płatności email'),
  emailLowBudget: optionalBoolean('Niskie saldo email'),
  smsReminders: optionalBoolean('Przypomnienia SMS'),
  inAppNotifications: optionalBoolean('Powiadomienia w aplikacji'),
});

class UserProfileController {
  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const profile = await userProfileService.getProfile(req.user!.id);
      res.json({ message: 'Profil pobrany pomyślnie', data: profile });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = updateProfileSchema.parse(req.body);
      const profile = await userProfileService.updateProfile(req.user!.id, data);
      res.json({ message: 'Profil zaktualizowany pomyślnie', data: profile });
    } catch (error) {
      next(error);
    }
  }

  async getNotificationPreferences(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const preferences = await userProfileService.getNotificationPreferences(req.user!.id);
      res.json({ message: 'Preferencje powiadomień pobrane pomyślnie', data: preferences });
    } catch (error) {
      next(error);
    }
  }

  async updateNotificationPreferences(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const preferences = updateNotificationPreferencesSchema.parse(req.body);
      const profile = await userProfileService.updateNotificationPreferences(req.user!.id, preferences);
      res.json({ message: 'Preferencje powiadomień zaktualizowane pomyślnie', data: profile });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserProfileController();
