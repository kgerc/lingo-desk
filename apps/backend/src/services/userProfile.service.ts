import prisma from '../utils/prisma';

export interface NotificationPreferences {
  emailReminders?: boolean;
  emailConfirmations?: boolean;
  emailCancellations?: boolean;
  emailPayments?: boolean;
  emailLowBudget?: boolean;
  smsReminders?: boolean;
  inAppNotifications?: boolean;
}

export interface UpdateProfileData {
  address?: string;
  emergencyContact?: string;
  notes?: string;
  languagePreference?: string;
  notificationPreferences?: NotificationPreferences;
}

class UserProfileService {
  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    let profile = await prisma.userProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Create profile if it doesn't exist
    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          userId,
          languagePreference: 'pl',
          notificationPreferences: {
            emailReminders: true,
            emailConfirmations: true,
            emailCancellations: true,
            emailPayments: true,
            emailLowBudget: true,
            smsReminders: false,
            inAppNotifications: true,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              role: true,
              avatarUrl: true,
            },
          },
        },
      });
    }

    return profile;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: UpdateProfileData) {
    // Check if profile exists, create if not
    await this.getProfile(userId);

    const profile = await prisma.userProfile.update({
      where: { userId },
      data: {
        ...(data.address !== undefined && { address: data.address }),
        ...(data.emergencyContact !== undefined && { emergencyContact: data.emergencyContact }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.languagePreference !== undefined && { languagePreference: data.languagePreference }),
        ...(data.notificationPreferences !== undefined && {
          notificationPreferences: data.notificationPreferences as any,
        }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
    });

    return profile;
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(userId: string, preferences: NotificationPreferences) {
    // Get current profile
    const currentProfile = await this.getProfile(userId);

    // Merge with existing preferences
    const currentPrefs = (currentProfile.notificationPreferences as NotificationPreferences) || {};
    const mergedPreferences = {
      ...currentPrefs,
      ...preferences,
    };

    return await this.updateProfile(userId, {
      notificationPreferences: mergedPreferences,
    });
  }

  /**
   * Get notification preferences for a user
   */
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const profile = await this.getProfile(userId);
    return (profile.notificationPreferences as NotificationPreferences) || {
      emailReminders: true,
      emailConfirmations: true,
      emailCancellations: true,
      emailPayments: true,
      emailLowBudget: true,
      smsReminders: false,
      inAppNotifications: true,
    };
  }
}

export default new UserProfileService();
