import api from '../lib/api';

export interface Notification {
  id: string;
  organizationId: string;
  userId: string;
  type: 'EMAIL' | 'SYSTEM' | 'ALERT';
  status: 'PENDING' | 'SENT' | 'FAILED';
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  scheduledFor: string;
  sentAt?: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetNotificationsParams {
  type?: 'EMAIL' | 'SYSTEM' | 'ALERT';
  status?: 'PENDING' | 'SENT' | 'FAILED';
  limit?: number;
}

const notificationService = {
  /**
   * Get current user's notifications
   */
  async getNotifications(params?: GetNotificationsParams): Promise<Notification[]> {
    const response = await api.get('/notifications', { params });
    return response.data.data;
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    const response = await api.get('/notifications/unread-count');
    return response.data.data.count;
  },

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<Notification> {
    const response = await api.put(`/notifications/${id}/read`);
    return response.data.data;
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all');
  },
};

export default notificationService;
