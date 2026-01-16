import api from '../lib/api';

interface SendBulkEmailData {
  subject: string;
  message: string;
  recipients: 'all' | 'selected' | 'debtors';
  selectedStudentIds?: string[];
  attachments?: File[];
}

interface SendBulkEmailResult {
  totalSent: number;
  totalFailed: number;
  totalRecipients: number;
  failedEmails: string[];
  attachmentsIncluded?: number;
  attachmentFailures?: number;
}

const mailingService = {
  sendBulkEmail: async (data: SendBulkEmailData): Promise<SendBulkEmailResult> => {
    const formData = new FormData();
    formData.append('subject', data.subject);
    formData.append('message', data.message);
    formData.append('recipients', data.recipients);

    if (data.selectedStudentIds && data.selectedStudentIds.length > 0) {
      formData.append('selectedStudentIds', JSON.stringify(data.selectedStudentIds));
    }

    if (data.attachments) {
      data.attachments.forEach((file) => {
        formData.append('attachments', file);
      });
    }

    const response = await api.post('/mailings/send-bulk', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }) as any;
    return response.data;
  },

  getDebtorsCount: async (): Promise<number> => {
    const response = await api.get('/mailings/debtors-count') as any;
    return response.data.count;
  },
};

export default mailingService;
