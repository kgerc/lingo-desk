import api from '../lib/api';

export type AlertType = 'ERROR' | 'WARNING' | 'INFO' | 'SUCCESS';

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface AlertsResponse {
  alerts: Alert[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const alertService = {
  /**
   * Get organization alerts with pagination
   */
  async getAlerts(options?: {
    page?: number;
    limit?: number;
    isRead?: boolean;
  }): Promise<AlertsResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.isRead !== undefined) params.append('isRead', options.isRead.toString());

    const response = await api.get(`/alerts?${params.toString()}`) as any;
    return response.data.data;
  },

  /**
   * Get count of unread alerts
   */
  async getUnreadCount(): Promise<number> {
    const response = await api.get('/alerts/unread-count') as any;
    return response.data.data.count;
  },

  /**
   * Mark specific alert as read
   */
  async markAsRead(alertId: string): Promise<Alert> {
    const response = await api.patch(`/alerts/${alertId}/read`) as any;
    return response.data.data;
  },

  /**
   * Mark all alerts as read
   */
  async markAllAsRead(): Promise<void> {
    await api.patch('/alerts/mark-all-read');
  },

  /**
   * Generate system alerts
   */
  async generateSystemAlerts(): Promise<Alert[]> {
    const response = await api.post('/alerts/generate') as any;
    return response.data.data;
  },
};

export default alertService;
