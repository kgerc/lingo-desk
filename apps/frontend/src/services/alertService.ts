import api from '../lib/api';

export type AlertType = 'ERROR' | 'WARNING' | 'INFO' | 'SUCCESS';

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  createdAt: Date;
}

const alertService = {
  /**
   * Get organization alerts
   */
  async getAlerts(): Promise<Alert[]> {
    const response = await api.get('/alerts');
    return response.data.data;
  },
};

export default alertService;
