import api from '../lib/api';

export interface NotificationPreferences {
  emailReminders?: boolean;
  emailConfirmations?: boolean;
  emailCancellations?: boolean;
  emailPayments?: boolean;
  emailLowBudget?: boolean;
  smsReminders?: boolean;
  inAppNotifications?: boolean;
}

export interface UserProfile {
  id: string;
  userId: string;
  address?: string;
  emergencyContact?: string;
  notes?: string;
  languagePreference: string;
  notificationPreferences?: NotificationPreferences;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: string;
    avatarUrl?: string;
  };
}

export interface UpdateProfileData {
  address?: string;
  emergencyContact?: string;
  notes?: string;
  languagePreference?: string;
}

class UserProfileService {
  async getProfile(): Promise<UserProfile> {
    const response = await api.get('/profile') as any;
    return response.data.data;
  }

  async updateProfile(data: UpdateProfileData): Promise<UserProfile> {
    const response = await api.put('/profile', data) as any;
    return response.data.data;
  }

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    const response = await api.get('/profile/notification-preferences') as any;
    return response.data.data;
  }

  async updateNotificationPreferences(preferences: NotificationPreferences): Promise<UserProfile> {
    const response = await api.put('/profile/notification-preferences', preferences) as any;
    return response.data.data;
  }
}

export default new UserProfileService();
