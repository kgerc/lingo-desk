import api from '../lib/api';

interface SendBulkEmailData {
  subject: string;
  message: string;
  recipients: 'all' | 'selected';
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
};

export default mailingService;
