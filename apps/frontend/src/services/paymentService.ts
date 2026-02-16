import api from '../lib/api';

export interface Payment {
  id: string;
  organizationId: string;
  studentId: string;
  enrollmentId?: string;
  lessonId?: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE' | 'OTHER';
  stripePaymentIntentId?: string;
  paidAt?: string;
  dueAt?: string;
  notes?: string;
  exchangeRateOverride?: number;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    userId: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  enrollment?: {
    id: string;
    course: {
      name: string;
    };
  };
  lesson?: {
    id: string;
    title: string;
    scheduledAt: string;
  };
  invoice?: {
    id: string;
    invoiceNumber: string;
  };
}

export interface CreatePaymentData {
  studentId: string;
  enrollmentId?: string;
  amount: number;
  currency?: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE' | 'OTHER';
  notes?: string;
  paidAt?: string;
  exchangeRateOverride?: number;
}

export interface UpdatePaymentData {
  amount?: number;
  currency?: string;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE' | 'OTHER';
  notes?: string;
  paidAt?: string;
  exchangeRateOverride?: number;
}

export interface GetPaymentsFilters {
  studentId?: string;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE' | 'OTHER';
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
  currency?: string;
  convertToCurrency?: string;
}

export interface PaymentStats {
  totalRevenue: number;
  pendingRevenue: number;
  completedPayments: number;
  pendingPayments: number;
}

export interface ReminderStatus {
  canSend: boolean;
  reason?: string;
  lastReminderAt?: string;
  nextAvailableAt?: string;
}

export interface PaymentReminder {
  id: string;
  organizationId: string;
  paymentId: string;
  studentId: string;
  type: 'MANUAL' | 'AUTO_BEFORE_DUE' | 'AUTO_ON_DUE' | 'AUTO_AFTER_DUE';
  sentAt: string;
  sentBy?: string;
  emailTo: string;
  subject: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// CSV Import types
export type SystemFieldKey = 'date' | 'email' | 'amount' | 'paymentMethod' | 'status' | 'notes';

export interface ColumnMapping {
  csvColumn: string;
  csvColumnIndex: number;
  systemField: SystemFieldKey | null;
  confidence: number;
}

export interface CsvAnalysisResult {
  separator: string;
  headers: string[];
  rowCount: number;
  preview: string[][];
  mapping: ColumnMapping[];
  warnings: string[];
}

export const SYSTEM_FIELDS: Array<{ key: SystemFieldKey; label: string; required: boolean }> = [
  { key: 'date', label: 'Data płatności', required: true },
  { key: 'email', label: 'Email ucznia', required: true },
  { key: 'amount', label: 'Kwota', required: true },
  { key: 'paymentMethod', label: 'Metoda płatności', required: true },
  { key: 'status', label: 'Status', required: false },
  { key: 'notes', label: 'Notatki', required: false },
];

const paymentService = {
  /**
   * Get all payments with filters
   */
  async getPayments(filters?: GetPaymentsFilters): Promise<Payment[]> {
    const response = await api.get('/payments', { params: filters }) as any;
    return response.data.data;
  },

  /**
   * Get payment by ID
   */
  async getPaymentById(id: string): Promise<Payment> {
    const response = await api.get(`/payments/${id}`) as any;
    return response.data.data;
  },

  /**
   * Create new payment
   */
  async createPayment(data: CreatePaymentData): Promise<Payment> {
    const response = await api.post('/payments', data) as any;
    return response.data.data;
  },

  /**
   * Update payment
   */
  async updatePayment(id: string, data: UpdatePaymentData): Promise<Payment> {
    const response = await api.put(`/payments/${id}`, data) as any;
    return response.data.data;
  },

  /**
   * Delete payment
   */
  async deletePayment(id: string): Promise<void> {
    await api.delete(`/payments/${id}`);
  },

  /**
   * Get payment statistics
   */
  async getPaymentStats(): Promise<PaymentStats> {
    const response = await api.get('/payments/stats') as any;
    return response.data.data;
  },

  /**
   * Get student payment history
   */
  async getStudentPaymentHistory(studentId: string): Promise<Payment[]> {
    const response = await api.get(`/payments/student/${studentId}`) as any;
    return response.data.data;
  },

  /**
   * Import payments from CSV
   */
  async importPayments(csvData: string): Promise<{
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string; data: string }>;
  }> {
    const response = await api.post('/payments/import', { csvData }) as any;
    return response.data.data;
  },

  /**
   * Analyze CSV file and get AI-based column mapping
   */
  async analyzeCsvImport(csvData: string): Promise<CsvAnalysisResult> {
    const response = await api.post('/payments/import/analyze', { csvData }) as any;
    return response.data.data;
  },

  /**
   * Execute CSV import with confirmed mapping
   */
  async executeCsvImport(
    csvData: string,
    mapping: ColumnMapping[],
    separator: string
  ): Promise<{
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string; data: string }>;
  }> {
    const response = await api.post('/payments/import/execute', {
      csvData,
      mapping,
      separator,
    }) as any;
    return response.data.data;
  },

  /**
   * Get debtors - students with pending payments
   */
  async getDebtors(): Promise<Array<{
    student: {
      id: string;
      userId: string;
      user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
      };
    };
    totalDebt: number;
    paymentsCount: number;
    oldestPaymentDate: string;
    daysSinceOldest: number;
    payments: Array<{
      id: string;
      amount: number;
      createdAt: string;
      dueAt?: string | null;
      notes?: string;
    }>;
  }>> {
    const response = await api.get('/payments/debtors') as any;
    return response.data.data;
  },

  /**
   * Send payment reminder
   */
  async sendReminder(paymentId: string): Promise<{ reminderId: string }> {
    const response = await api.post(`/payments/${paymentId}/reminder`) as any;
    return response.data.data;
  },

  /**
   * Get reminder status for payment
   */
  async getReminderStatus(paymentId: string): Promise<ReminderStatus> {
    const response = await api.get(`/payments/${paymentId}/reminder/status`) as any;
    return response.data.data;
  },

  /**
   * Get payment reminder history
   */
  async getPaymentReminders(paymentId: string): Promise<PaymentReminder[]> {
    const response = await api.get(`/payments/${paymentId}/reminders`) as any;
    return response.data.data;
  },
};

export default paymentService;
