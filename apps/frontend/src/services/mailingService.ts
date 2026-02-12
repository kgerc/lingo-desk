import api from '../lib/api';

export type MailType = 'custom' | 'welcome' | 'reminder' | 'payment' | 'teacher-rating' | 'survey' | 'complaint';

interface SendBulkEmailData {
  subject: string;
  message: string;
  mailType: MailType;
  recipients: 'all' | 'selected' | 'debtors' | 'course' | 'lesson';
  selectedStudentIds?: string[];
  courseId?: string;
  lessonId?: string;
  scheduledAt?: string;
  attachments?: File[];
}

interface SendBulkEmailResult {
  totalSent: number;
  totalFailed: number;
  totalRecipients: number;
  failedEmails: string[];
  attachmentsIncluded?: number;
  attachmentFailures?: number;
  scheduled?: boolean;
  scheduledAt?: string;
  scheduledId?: string;
}

const mailingService = {
  sendBulkEmail: async (data: SendBulkEmailData): Promise<SendBulkEmailResult> => {
    const formData = new FormData();
    formData.append('subject', data.subject);
    formData.append('message', data.message);
    formData.append('mailType', data.mailType);
    formData.append('recipients', data.recipients);

    if (data.selectedStudentIds && data.selectedStudentIds.length > 0) {
      formData.append('selectedStudentIds', JSON.stringify(data.selectedStudentIds));
    }

    if (data.courseId) {
      formData.append('courseId', data.courseId);
    }

    if (data.lessonId) {
      formData.append('lessonId', data.lessonId);
    }

    if (data.scheduledAt) {
      formData.append('scheduledAt', data.scheduledAt);
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
