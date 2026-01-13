import api from '../lib/api';

interface SendBulkEmailData {
  subject: string;
  message: string;
  recipients: 'all' | 'selected' | 'debtors';
  selectedStudentIds?: string[];
}

interface SendBulkEmailResult {
  totalSent: number;
  totalFailed: number;
  totalRecipients: number;
  failedEmails: string[];
}

const mailingService = {
  sendBulkEmail: async (data: SendBulkEmailData): Promise<SendBulkEmailResult> => {
    const response = await api.post('/mailings/send-bulk', data);
    return response.data;
  },

  getDebtorsCount: async (): Promise<number> => {
    const response = await api.get('/mailings/debtors-count');
    return response.data.count;
  },
};

export default mailingService;
